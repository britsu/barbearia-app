// functions/index.js

/**
 * Import dos módulos necessários:
 * - onRequest: para criar HTTP trigger (Cloud Function v2)
 * - logger: para logs
 * - cors: para habilitar CORS (permite que o front-end local chame estas funções)
 * - admin: para inicializar o Firebase Admin e acessar o Firestore
 */
const { onRequest } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const cors = require("cors")({ origin: true });

// Inicializa o Firebase Admin
admin.initializeApp();
const db = admin.firestore();

/**
 * GET  /getServicos
 * Retorna todos os documentos da coleção "servicos" ordenados por nome_servico.
 * Cada documento sai com o formato:
 *   { id_servico: <ID do doc>, nome_servico: <string>, preco: <number>, duracao_min: <number>, … }
 */
exports.getServicos = onRequest((req, res) => {
  // Envolver em CORS para que seja possível chamar do frontend sem erro de bloqueio:
  cors(req, res, async () => {
    try {
      const snapshot = await db
        .collection("servicos")
        .orderBy("nome_servico")
        .get();

      const lista = snapshot.docs.map(doc => ({
        id_servico: doc.id,
        ...doc.data()
      }));

      return res.status(200).json(lista);
    } catch (erro) {
      logger.error("Erro em getServicos:", erro);
      return res
        .status(500)
        .json({ error: "Não foi possível buscar serviços." });
    }
  });
});

/**
 * GET  /getProfissionais
 * Retorna todos os documentos da coleção "profissionais" ordenados por nome_profissional.
 * Cada documento sai com o formato:
 *   { id_profissional: <ID do doc>, nome_profissional: <string>, servicos_disponiveis: [<ids>], foto_url: <string>, … }
 */
exports.getProfissionais = onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const snapshot = await db
        .collection("profissionais")
        .orderBy("nome_profissional")
        .get();

      const lista = snapshot.docs.map(doc => ({
        id_profissional: doc.id,
        ...doc.data()
      }));

      return res.status(200).json(lista);
    } catch (erro) {
      logger.error("Erro em getProfissionais:", erro);
      return res
        .status(500)
        .json({ error: "Não foi possível buscar profissionais." });
    }
  });
});

/**
 * GET  /getTurnos?data=YYYY-MM-DD&idServico=<id>
 * 
 * Query parameters obrigatórios:
 *   data (string, formato "YYYY-MM-DD")
 *   idServico (string, ID do serviço)
 *
 * Lógica:
 *  1) Filtra todos os profissionais cujo array `servicos_disponiveis` contenha `idServico`.
 *  2) Busca na coleção "turnos" todos os documentos que tenham:
 *       - data == dataEscolhida
 *       - status == "livre"
 *       - id_profissional ∈ [lista de IDs filtrados]
 *     Ordena o resultado por hora.
 *  3) Retorna um array de turnos com cada objeto:
 *       { id_turno: <ID do doc>, data: <"YYYY-MM-DD">, hora: <"HH:MM">, id_profissional: <string>, status: "livre" }
 */
exports.getTurnos = onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const dataEscolhida = req.query.data;
      const idServico = req.query.idServico;

      if (!dataEscolhida || !idServico) {
        return res
          .status(400)
          .json({ error: "Parâmetros 'data' e 'idServico' são obrigatórios." });
      }

      // 1) Filtrar profissionais que atendem a este serviço
      const profSnapshot = await db
        .collection("profissionais")
        .where("servicos_disponiveis", "array-contains", idServico)
        .get();
      const profIDs = profSnapshot.docs.map((doc) => doc.id);

      // Se não houver nenhum profissional para este serviço, devolve array vazio
      if (profIDs.length === 0) {
        return res.status(200).json([]);
      }

      // 2) Buscar turnos livres desta data para esses profissionais
      const turnosSnapshot = await db
        .collection("turnos")
        .where("data", "==", dataEscolhida)
        .where("status", "==", "livre")
        .where("id_profissional", "in", profIDs)
        .orderBy("hora")
        .get();

      const listaTurnos = turnosSnapshot.docs.map((doc) => ({
        id_turno: doc.id,
        ...doc.data(),
      }));

      return res.status(200).json(listaTurnos);
    } catch (erro) {
      logger.error("Erro em getTurnos:", erro);
      return res
        .status(500)
        .json({ error: "Não foi possível buscar turnos." });
    }
  });
});

/**
 * POST /postAgendar
 *
 * Body JSON esperado:
 * {
 *   id_turno: <string>,
 *   id_servico: <string>,
 *   nome_cliente: <string>,
 *   telefone_cliente: <string>
 * }
 *
 * Fluxo:
 *  1) Verifica se o documento "turnos/{id_turno}" existe e está status == "livre".
 *  2) Se estiver livre, atualiza o campo status para "reservado".
 *  3) Lê os dados de "servicos/{id_servico}" e de "profissionais/{id_profissional}" (o id_profissional vem do próprio turno).
 *  4) Monta o texto de confirmação e gera link_whatsapp.
 *  5) Grava um novo documento em "agendamentos" com os campos:
 *       { id_turno, id_servico, nome_cliente, telefone_cliente, link_whatsapp, timestamp }
 *  6) Retorna { success: true, link_whatsapp } ou, em erro, { success: false, message: "…mensagem" }.
 */
exports.postAgendar = onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      // Só aceitar POST
      if (req.method !== "POST") {
        return res
          .status(405)
          .json({ success: false, message: "Método não permitido." });
      }

      const {
        id_turno,
        id_servico,
        nome_cliente,
        telefone_cliente,
      } = req.body;

      // Validação de campos obrigatórios
      if (!id_turno || !id_servico || !nome_cliente || !telefone_cliente) {
        return res
          .status(400)
          .json({ success: false, message: "Campos obrigatórios faltando." });
      }

      // 1) Verificar se o turno existe e está “livre”
      const turnoRef = db.collection("turnos").doc(id_turno);
      const turnoSnap = await turnoRef.get();

      if (!turnoSnap.exists) {
        return res
          .status(404)
          .json({ success: false, message: "Turno não encontrado." });
      }

      const turnoData = turnoSnap.data();
      if (turnoData.status !== "livre") {
        return res
          .status(400)
          .json({ success: false, message: "Turno indisponível." });
      }

      // 2) Marcar turno como “reservado”
      await turnoRef.update({ status: "reservado" });

      // 3) Buscar dados de serviço e profissional
      const servicoSnap = await db.collection("servicos").doc(id_servico).get();
      if (!servicoSnap.exists) {
        return res
          .status(404)
          .json({ success: false, message: "Serviço não encontrado." });
      }
      const servicoData = servicoSnap.data();

      const profSnap = await db
        .collection("profissionais")
        .doc(turnoData.id_profissional)
        .get();
      if (!profSnap.exists) {
        return res
          .status(404)
          .json({ success: false, message: "Profissional não encontrado." });
      }
      const profData = profSnap.data();

      // 4) Montar texto e link para WhatsApp
      //    Exemplo de texto (cada quebra de linha virará %0A no encodeURI):
      //    Olá, gostaria de confirmar meu agendamento:
      //    Serviço: [NOME_SERVIÇO]
      //    Profissional: [NOME_PROFISSIONAL]
      //    Data: [DD/MM/YYYY] – [HH:MM]
      //    Nome: [NOME_CLIENTE]
      //    Telefone: [TELEFONE_CLIENTE]
      const [yyyy, mm, dd] = turnoData.data.split("-");
      const dataFormatada = `${dd}/${mm}/${yyyy}`;
      const horaFormatada = turnoData.hora;

      const texto =
        `Olá, gostaria de confirmar meu agendamento:\n` +
        `Serviço: ${servicoData.nome_servico}\n` +
        `Profissional: ${profData.nome_profissional}\n` +
        `Data: ${dataFormatada} – ${horaFormatada}\n` +
        `Nome: ${nome_cliente}\n` +
        `Telefone: ${telefone_cliente}`;

      const telSemSinais = telefone_cliente.replace(/\D/g, "");
      const link_whatsapp = `https://wa.me/55${telSemSinais}?text=${encodeURIComponent(
        texto
      )}`;

      // 5) Gravar documento em “agendamentos”
      await db.collection("agendamentos").add({
        id_turno,
        id_servico,
        nome_cliente,
        telefone_cliente: telSemSinais,
        link_whatsapp,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 6) Retorna sucesso + link
      return res.status(200).json({ success: true, link_whatsapp });
    } catch (erro) {
      logger.error("Erro em postAgendar:", erro);
      return res
        .status(500)
        .json({ success: false, message: "Erro interno ao agendar." });
    }
  });
});
