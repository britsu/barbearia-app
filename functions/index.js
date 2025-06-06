// functions/index.js

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const cors  = require("cors")({ origin: true });

// Inicializa usando Application Default Credentials (ADC).
// Isso evita ter que versionar um arquivo serviceAccountKey.json
admin.initializeApp();
const db = admin.firestore();

exports.getServicos = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const snapshot = await db.collection("servicos")
        .orderBy("nome_servico")
        .get();
      const lista = snapshot.docs.map(doc => ({
        id_servico: doc.id,
        ...doc.data()
      }));
      return res.status(200).json(lista);
    } catch (erro) {
      console.error("Erro em getServicos:", erro);
      return res.status(500).json({ error: "Não foi possível buscar serviços." });
    }
  });
});

exports.getProfissionais = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const snapshot = await db.collection("profissionais")
        .orderBy("nome_profissional")
        .get();
      const lista = snapshot.docs.map(doc => ({
        id_profissional: doc.id,
        ...doc.data()
      }));
      return res.status(200).json(lista);
    } catch (erro) {
      console.error("Erro em getProfissionais:", erro);
      return res.status(500).json({ error: "Não foi possível buscar profissionais." });
    }
  });
});

exports.getTurnos = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const dataEscolhida = req.query.data;
      const idServico     = req.query.idServico;

      if (!dataEscolhida || !idServico) {
        return res
          .status(400)
          .json({ error: "Parâmetros ‘data’ e ‘idServico’ são obrigatórios." });
      }

      // 1) Profissionais que atendem este serviço
      const profSnapshot = await db.collection("profissionais")
        .where("servicos_disponiveis", "array-contains", idServico)
        .get();
      const profIDs = profSnapshot.docs.map(doc => doc.id);
      if (profIDs.length === 0) {
        return res.status(200).json([]); // sem profissionais → sem turnos
      }

      // 2) Buscar turnos livres daquela data, apenas para esses profissionais
      const turnosSnapshot = await db.collection("turnos")
        .where("data", "==", dataEscolhida)
        .where("status", "==", "livre")
        .where("id_profissional", "in", profIDs)
        .orderBy("hora")
        .get();
      const listaTurnos = turnosSnapshot.docs.map(doc => ({
        id_turno: doc.id,
        ...doc.data()
      }));

      return res.status(200).json(listaTurnos);
    } catch (erro) {
      console.error("Erro em getTurnos:", erro);
      return res.status(500).json({ error: "Não foi possível buscar turnos." });
    }
  });
});

exports.postAgendar = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== "POST") {
        return res.status(405).json({ success: false, message: "Método não permitido." });
      }

      const {
        id_turno,
        id_servico,
        nome_cliente,
        telefone_cliente
      } = req.body;

      if (!id_turno || !id_servico || !nome_cliente || !telefone_cliente) {
        return res
          .status(400)
          .json({ success: false, message: "Campos faltando." });
      }

      // 1) Verifica status do turno
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

      // 2) Atualiza para “reservado”
      await turnoRef.update({ status: "reservado" });

      // 3) Busca dados de serviço e profissional
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

      // 4) Monta link para WhatsApp
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
      const link_whatsapp = `https://wa.me/55${telSemSinais}?text=${encodeURIComponent(texto)}`;

      // 5) Grava em “agendamentos”
      await db.collection("agendamentos").add({
        id_turno,
        id_servico,
        nome_cliente,
        telefone_cliente: telSemSinais,
        link_whatsapp,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      return res.status(200).json({ success: true, link_whatsapp });
    } catch (erro) {
      console.error("Erro em postAgendar:", erro);
      return res
        .status(500)
        .json({ success: false, message: "Erro interno ao agendar." });
    }
  });
});
