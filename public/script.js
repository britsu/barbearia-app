// ----------------------------------------
// 3.1) Constantes e variáveis globais
// ----------------------------------------

let listaServicos = [];
let listaProfissionais = [];
let listaTurnos       = [];

// Estado atual do agendamento:
let estado = {
  servicoSelecionado: null,   // objeto { id_servico, nome_servico, preco, duracao_min }
  dataSelecionada:    null,   // string no formato "YYYY-MM-DD"
  profissionalID:     null,   // id_profissional (string)
  profissionalNome:   null,   // nome_profissional (string)
  horarioSelecionado: null,   // string "HH:MM"
  idTurnoSelecionado: null    // id_turno (string)
};

// ----------------------------------------
// 3.2) Ao carregar DOMContentLoaded → inicializar
// ----------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
  await carregarServicos();
  await carregarProfissionais();
});

// ----------------------------------------
// Função: carregarServicos → busca no Firestore
// ----------------------------------------
async function carregarServicos() {
  try {
    const snapshot = await db.collection('servicos').get();
    listaServicos = snapshot.docs.map(doc => {
      const dados = doc.data();
      return {
        id_servico: doc.id,
        nome_servico: dados.nome_servico,
        preco: dados.preco,
        duracao_min: dados.duracao_min
      };
    });
    montarCardsServicos();
  } catch (err) {
    console.error('Erro ao buscar serviços no Firestore:', err);
  }
}

// ----------------------------------------
// Função: montarCardsServicos
// ----------------------------------------
function montarCardsServicos() {
  const container = document.getElementById('listaServicosContainer');
  container.innerHTML = '';

  listaServicos.forEach(serv => {
    const card = document.createElement('div');
    card.classList.add('card-servico');
    card.dataset.id = serv.id_servico;

    card.innerHTML = `
      <h3>${serv.nome_servico.toUpperCase()}</h3>
      <p>${serv.duracao_min} min</p>
    `;

    card.addEventListener('click', () => {
      iniciarFluxoAgendamento(serv);
    });

    container.appendChild(card);
  });
}

// ----------------------------------------
// Função: iniciarFluxoAgendamento(servico)
// ----------------------------------------
function iniciarFluxoAgendamento(servico) {
  estado.servicoSelecionado = servico;

  document.getElementById('secServicos').classList.add('hidden');
  document.getElementById('secAgendamento').classList.remove('hidden');

  document.getElementById('textoServicoEscolhido').innerText = servico.nome_servico;

  const inputDate = document.getElementById('inputData');
  const hoje = new Date().toISOString().split('T')[0];
  inputDate.setAttribute('min', hoje);

  inputDate.addEventListener('change', onDataSelecionada);
  document.getElementById('passoEscolherData').scrollIntoView({ behavior: 'smooth' });
}

// ----------------------------------------
// Função: onDataSelecionada()
// ----------------------------------------
async function onDataSelecionada(e) {
  const data = e.target.value;
  if (!data) return;

  estado.dataSelecionada = data;
  document.getElementById('passoEscolherProfissional').classList.remove('hidden');

  // Limpa dropdown e coloca opção padrão
  const selectProf = document.getElementById('selectProfissional');
  selectProf.innerHTML = '<option value="">-- Selecione um profissional --</option>';

  // Filtra apenas profissionais que atendem ao serviço selecionado
  const idServ = estado.servicoSelecionado.id_servico;
  const profsFiltrados = listaProfissionais.filter(p =>
    p.servicos_disponiveis.includes(idServ)
  );

  profsFiltrados.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id_profissional;
    opt.text = p.nome_profissional;
    selectProf.appendChild(opt);
  });

  selectProf.addEventListener('change', onProfissionalSelecionado);
  document.getElementById('passoEscolherProfissional').scrollIntoView({ behavior: 'smooth' });
}

// ----------------------------------------
// Função: carregarProfissionais → busca no Firestore
// ----------------------------------------
async function carregarProfissionais() {
  try {
    const snapshot = await db.collection('profissionais').get();
    listaProfissionais = snapshot.docs.map(doc => {
      const dados = doc.data();
      return {
        id_profissional: doc.id,
        nome_profissional: dados.nome_profissional,
        servicos_disponiveis: dados.servicos_disponiveis // array de IDs
      };
    });
  } catch (err) {
    console.error('Erro ao buscar profissionais no Firestore:', err);
  }
}

// ----------------------------------------
// Função: onProfissionalSelecionado()
// ----------------------------------------
async function onProfissionalSelecionado(e) {
  const idProf = e.target.value;
  if (!idProf) return;

  const profObj = listaProfissionais.find(p => p.id_profissional === idProf);
  estado.profissionalID   = idProf;
  estado.profissionalNome = profObj.nome_profissional;

  document.getElementById('passoEscolherHorario').classList.remove('hidden');
  const containerHorarios = document.getElementById('botoesHorariosContainer');
  containerHorarios.innerHTML = '';

  // 1) Carrega turnos disponíveis do Firestore
  await carregarTurnosDisponiveis(estado.dataSelecionada, estado.servicoSelecionado.id_servico);

  // 2) Filtra turnos apenas para este profissional
  const turnosParaProf = listaTurnos.filter(t => t.id_profissional === idProf && t.status === 'livre');

  // 3) Monta botões de horário
  turnosParaProf.forEach(t => {
    const btn = document.createElement('button');
    btn.classList.add('btn-horario');
    btn.innerText = t.hora;
    btn.dataset.idTurno = t.id_turno;

    btn.addEventListener('click', () => {
      onHorarioSelecionado(t.hora, t.id_turno, btn);
    });

    containerHorarios.appendChild(btn);
  });

  document.getElementById('passoEscolherHorario').scrollIntoView({ behavior: 'smooth' });
}

// ----------------------------------------
// Função: carregarTurnosDisponiveis (busca no Firestore)
// ----------------------------------------
async function carregarTurnosDisponiveis(dataEscolhida, idServico) {
  listaTurnos = [];
  try {
    // Exemplo: coleção raiz “turnos”
    const snapshot = await db
      .collection('turnos')
      .where('data', '==', dataEscolhida)
      .get();

    listaTurnos = snapshot.docs.map(doc => {
      const t = doc.data();
      return {
        id_turno: doc.id,
        data: t.data,
        hora: t.hora,
        id_profissional: t.id_profissional,
        status: t.status,
        servicoID: t.servicoID // se existir esse campo
      };
    });
  } catch (err) {
    console.error('Erro ao buscar turnos no Firestore:', err);
  }
}

// ----------------------------------------
// Função: onHorarioSelecionado(horario, idTurno, btn)
// ----------------------------------------
function onHorarioSelecionado(horario, idTurno, btn) {
  estado.horarioSelecionado = horario;
  estado.idTurnoSelecionado = idTurno;

  document.querySelectorAll('.btn-horario').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  document.getElementById('passoResumo').classList.remove('hidden');
  document.getElementById('resumoServico').innerText       = estado.servicoSelecionado.nome_servico;
  document.getElementById('resumoData').innerText         = estado.dataSelecionada.split('-').reverse().join('/');
  document.getElementById('resumoProfissional').innerText = estado.profissionalNome;
  document.getElementById('resumoHorario').innerText      = estado.horarioSelecionado;

  document.getElementById('passoDadosCliente').classList.remove('hidden');
  document.getElementById('passoResumo').scrollIntoView({ behavior: 'smooth' });

  const inputNome = document.getElementById('nomeCliente');
  const inputTel  = document.getElementById('telefoneCliente');
  const btnAgendar = document.getElementById('btnConfirmarAgendamento');

  inputNome.value = '';
  inputTel.value  = '';
  btnAgendar.disabled = true;

  inputNome.addEventListener('input', () => {
    btnAgendar.disabled = !(inputNome.value.trim() && inputTel.value.trim());
  });
  inputTel.addEventListener('input', () => {
    btnAgendar.disabled = !(inputNome.value.trim() && inputTel.value.trim());
  });

  btnAgendar.addEventListener('click', onConfirmarAgendamento);
}

// ----------------------------------------
// Função: onConfirmarAgendamento() → grava no Firestore
// ----------------------------------------
async function onConfirmarAgendamento() {
  const nome  = document.getElementById('nomeCliente').value.trim();
  const tel   = document.getElementById('telefoneCliente').value.trim();
  const idTurno = estado.idTurnoSelecionado;
  const idServ  = estado.servicoSelecionado.id_servico;
  const idProf  = estado.profissionalID;
  const dataSel = estado.dataSelecionada;
  const horaSel = estado.horarioSelecionado;

  if (!nome || !tel) {
    document.getElementById('msgAgendamento').innerText = 'Por favor, preencha nome e telefone.';
    return;
  }

  try {
    // 1) Cria reserva
    const reservaData = {
      id_turno: idTurno,
      id_servico: idServ,
      id_profissional: idProf,
      nome_cliente: nome,
      telefone_cliente: tel,
      data: dataSel,
      hora: horaSel,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };
    const docRefReserva = await db.collection('reservas').add(reservaData);

    // 2) Atualiza turno para “reservado”
    await db.collection('turnos').doc(idTurno).update({
      status: 'reservado',
      reservaID: docRefReserva.id
    });

    // 3) Abre WhatsApp e mostra mensagem
    const mensagem = `Olá, ${nome}!
Seu agendamento para "${estado.servicoSelecionado.nome_servico}" está confirmado em ${dataSel} às ${horaSel} com ${estado.profissionalNome}.`;
    const urlWhats = `https://wa.me/55${tel}?text=${encodeURIComponent(mensagem)}`;

    document.getElementById('msgAgendamento').innerText  = 'Agendamento enviado! Abrindo WhatsApp…';
    document.getElementById('msgAgendamento').classList.add('sucesso');
    window.open(urlWhats, '_blank');

    // 4) (Opcional) Recarrega a página após 3 segundos
    setTimeout(() => {
      window.location.reload();
    }, 3000);

  } catch (err) {
    console.error('Erro ao gravar agendamento no Firestore:', err);
    document.getElementById('msgAgendamento').innerText = 'Erro ao enviar agendamento.';
    document.getElementById('msgAgendamento').classList.remove('sucesso');
  }
}
