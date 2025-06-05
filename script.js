// ----------------------------------------
// 3.1) Constantes e variáveis globais
// ----------------------------------------

// Substitua pela URL exata do seu Web App (Apps Script), termina em /exec
const API_BASE = 'https://script.google.com/macros/s/AKfycbyrl5aCc7Xfw_GrzOYMmkGtnXtlMBhOtQuCFHDoMSZqKhMXAoR9YpdhN0hiWgRA4Fxo/exec';

let listaServicos = [];
let listaProfissionais = [];
let listaTurnos       = [];

// Estado atual do agendamento:
let estado = {
  servicoSelecionado: null,   // objeto { id_servico, nome_servico, preco, duracao_min }
  dataSelecionada:    null,   // string no formato "YYYY-MM-DD"
  profissionalID:     null,   // id_profissional (string)
  profissionalNome:   null,   // nome_profissional (string)
  horarioSelecionado: null    // string "HH:MM"
};

// ----------------------------------------
// 3.2) Ao carregar DOMContentLoaded → inicializar
// ----------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  carregarServicos();
});

// ----------------------------------------
// 3.3) Função: carregarServicos
//    → faz GET ?action=servicos, preenche #listaServicosContainer
// ----------------------------------------

async function carregarServicos() {
  try {
    const response = await fetch(`${API_BASE}?action=servicos`);
    const dados = await response.json();

    if (dados.error) {
      console.error('Erro ao buscar serviços:', dados.error);
      return;
    }

    listaServicos = dados; // array de objetos { id_servico, nome_servico, preco, duracao_min }

    montarCardsServicos();
  } catch (err) {
    console.error('Erro ao buscar serviços:', err);
  }
}

function montarCardsServicos() {
  const container = document.getElementById('listaServicosContainer');
  container.innerHTML = ''; // limpa antes

  listaServicos.forEach(serv => {
    const card = document.createElement('div');
    card.classList.add('card-servico');
    card.dataset.id = serv.id_servico;

    // Estrutura interna do card
    card.innerHTML = `
      <h3>${serv.nome_servico.toUpperCase()}</h3>
      <p>${serv.duracao_min} min</p>
    `;

    // Ao clicar no card → iniciar fluxo de agendamento
    card.addEventListener('click', () => {
      iniciarFluxoAgendamento(serv);
    });

    container.appendChild(card);
  });
}

// ----------------------------------------
// 3.4) Função: iniciarFluxoAgendamento(servico)
// ----------------------------------------

function iniciarFluxoAgendamento(servico) {
  // 1) gravar estado de serviço selecionado
  estado.servicoSelecionado = servico;

  // 2) esconder seção de serviços e mostrar seção de agendamento
  document.getElementById('secServicos').classList.add('hidden');
  document.getElementById('secAgendamento').classList.remove('hidden');

  // 3) atualizar o texto do serviço selecionado
  document.getElementById('textoServicoEscolhido').innerText = servico.nome_servico;

  // 4) definir data mínima (hoje) no input[type=date]
  const inputDate = document.getElementById('inputData');
  const hoje = new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"
  inputDate.setAttribute('min', hoje);

  // 5) adicionar listener para quando a data for escolhida
  inputDate.addEventListener('change', onDataSelecionada);

  // 6) fazer scroll automático até “Escolher Data”
  document.getElementById('passoEscolherData').scrollIntoView({ behavior: 'smooth' });
}

// ----------------------------------------
// 3.5) Função: onDataSelecionada()
//    → quando o usuário escolhe data
// ----------------------------------------

async function onDataSelecionada(e) {
  const data = e.target.value; // ex: "2025-06-10"
  if (!data) return;

  estado.dataSelecionada = data;

  // Exibir o passo de escolher profissional
  document.getElementById('passoEscolherProfissional').classList.remove('hidden');

  // Limpar dropdown anterior e adicionar opção default
  const selectProf = document.getElementById('selectProfissional');
  selectProf.innerHTML = '<option value="">-- Selecione um profissional --</option>';

  // Buscar lista de profissionais (já carregada previamente? se não, faz GET)
  if (listaProfissionais.length === 0) {
    await carregarProfissionais();
  }

  // Filtrar profissionais que atendem ao serviço selecionado
  const idServ = estado.servicoSelecionado.id_servico;
  const profsFiltrados = listaProfissionais.filter(p =>
    p.servicos_disponiveis.includes(idServ)
  );

  // Preencher opções no select
  profsFiltrados.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id_profissional;
    opt.text = p.nome_profissional;
    selectProf.appendChild(opt);
  });

  // Adicionar listener para mudança de profissional
  selectProf.addEventListener('change', onProfissionalSelecionado);

  // Scroll até dropdown de profissionais
  document.getElementById('passoEscolherProfissional').scrollIntoView({ behavior: 'smooth' });
}

// ----------------------------------------
// 3.6) Função: carregarProfissionais()
//    → faz GET ?action=profissionais
// ----------------------------------------

async function carregarProfissionais() {
  try {
    const response = await fetch(`${API_BASE}?action=profissionais`);
    const dados = await response.json();

    if (dados.error) {
      console.error('Erro ao buscar profissionais:', dados.error);
      return;
    }

    // dados é array de { id_profissional, nome_profissional, servicos_disponiveis: [ ... ] }
    listaProfissionais = dados;
  } catch (err) {
    console.error('Erro ao buscar profissionais:', err);
  }
}

// ----------------------------------------
// 3.7) Função: onProfissionalSelecionado()
// ----------------------------------------

async function onProfissionalSelecionado(e) {
  const idProf = e.target.value;
  if (!idProf) return;

  // Capturar nome do profissional selecionado
  const profObj = listaProfissionais.find(p => p.id_profissional === idProf);
  estado.profissionalID   = idProf;
  estado.profissionalNome = profObj.nome_profissional;

  // Exibir o passo de escolher horário
  document.getElementById('passoEscolherHorario').classList.remove('hidden');

  // Limpar botões de horário anteriores
  const containerHorarios = document.getElementById('botoesHorariosContainer');
  containerHorarios.innerHTML = '';

  // Buscar horários disponíveis via GET ?action=turnos&data=YYYY-MM-DD&idServico=ID
  await carregarTurnosDisponiveis(estado.dataSelecionada, estado.servicoSelecionado.id_servico);

  // Filtrar apenas os turnos em que id_profissional === “estado.profissionalID”
  const turnosParaProf = listaTurnos.filter(t => t.id_profissional === idProf);

  // Montar botões de horário
  turnosParaProf.forEach(t => {
    const btn = document.createElement('button');
    btn.classList.add('btn-horario');
    btn.innerText = t.hora;     // ex: "11:00"
    btn.dataset.idTurno = t.id_turno;

    btn.addEventListener('click', () => {
      onHorarioSelecionado(t.hora, t.id_turno, btn);
    });

    containerHorarios.appendChild(btn);
  });

  // Scroll até botões de horário
  document.getElementById('passoEscolherHorario').scrollIntoView({ behavior: 'smooth' });
}

// ----------------------------------------
// 3.8) Função: carregarTurnosDisponiveis(data, idServico)
//    → faz GET ?action=turnos&data=YYYY-MM-DD&idServico=ID
// ----------------------------------------

async function carregarTurnosDisponiveis(dataEscolhida, idServico) {
  try {
    const response = await fetch(`${API_BASE}?action=turnos&data=${dataEscolhida}&idServico=${idServico}`);
    const dados = await response.json();

    if (dados.error) {
      console.error('Erro ao buscar turnos:', dados.error);
      return;
    }

    // Retorna array de objetos { id_turno, data, hora, id_profissional }
    listaTurnos = dados;
  } catch (err) {
    console.error('Erro ao buscar turnos:', err);
  }
}

// ----------------------------------------
// 3.9) Função: onHorarioSelecionado(horario, idTurno, btn)
// ----------------------------------------

function onHorarioSelecionado(horario, idTurno, btn) {
  // 1) Renderizar estado atual
  estado.horarioSelecionado = horario;
  estado.idTurnoSelecionado = idTurno; // para usar no payload de agendamento

  // 2) Marcar o botão como “ativo” e remover active de outros
  document.querySelectorAll('.btn-horario').forEach(b => {
    b.classList.remove('active');
  });
  btn.classList.add('active');

  // 3) Exibir o passo de Resumo
  document.getElementById('passoResumo').classList.remove('hidden');

  // Preencher os spans com dados salvos em estado
  document.getElementById('resumoServico').innerText = estado.servicoSelecionado.nome_servico;
  document.getElementById('resumoData').innerText   = estado.dataSelecionada.split('-').reverse().join('/'); // “DD/MM/YYYY”
  document.getElementById('resumoProfissional').innerText = estado.profissionalNome;
  document.getElementById('resumoHorario').innerText = estado.horarioSelecionado;

  // 4) Exibir o passo de Dados do Cliente
  document.getElementById('passoDadosCliente').classList.remove('hidden');

  // 5) ...
  document.getElementById('passoResumo').scrollIntoView({ behavior: 'smooth' });

  // 6) Habilitar botão AGENDAR apenas quando campos nome+telefone estiverem preenchidos
  const inputNome = document.getElementById('nomeCliente');
  const inputTel  = document.getElementById('telefoneCliente');
  const btnAgendar = document.getElementById('btnConfirmarAgendamento');

  // Limpar campos de nome e telefone
  inputNome.value = '';
  inputTel.value  = '';
  btnAgendar.disabled = true;

  // Adicionar event listeners para verificar se ambos estão preenchidos
  inputNome.addEventListener('input', () => {
    btnAgendar.disabled = !(inputNome.value.trim() && inputTel.value.trim());
  });
  inputTel.addEventListener('input', () => {
    btnAgendar.disabled = !(inputNome.value.trim() && inputTel.value.trim());
  });

  // Adicionar listener para o clique em “AGENDAR”
  btnAgendar.addEventListener('click', onConfirmarAgendamento);
}

// ----------------------------------------
// 3.10) Função: onConfirmarAgendamento()
//    → faz POST para backend (action: "agendamento")
// ----------------------------------------

async function onConfirmarAgendamento() {
  const nome  = document.getElementById('nomeCliente').value.trim();
  const tel   = document.getElementById('telefoneCliente').value.trim();
  const idTurno = estado.idTurnoSelecionado;
  const idServ  = estado.servicoSelecionado.id_servico;

  // Montar payload conforme formato do Apps Script
  const payload = {
    action: 'agendamento',
    payload: {
      id_turno: idTurno,
      id_servico: idServ,
      nome_cliente: nome,
      telefone_cliente: tel
    }
  };

  try {
    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const dados = await response.json();
    if (dados.error) {
      document.getElementById('msgAgendamento').innerText = `Erro: ${dados.error}`;
      document.getElementById('msgAgendamento').classList.remove('sucesso');
    } else {
      // Sucesso: abrir link WhatsApp, exibir mensagem de sucesso e opcionalmente resetar tudo
      window.open(dados.link_whatsapp, '_blank');

      document.getElementById('msgAgendamento').innerText = 'Agendamento enviado! Abrindo WhatsApp...';
      document.getElementById('msgAgendamento').classList.add('sucesso');

      // Se quiser, após 3s redireciona de volta à tela inicial:
      setTimeout(() => {
        window.location.reload();
      }, 3000);
    }
  } catch (err) {
    console.error('Erro no POST agendamento:', err);
    document.getElementById('msgAgendamento').innerText = 'Erro ao enviar agendamento.';
    document.getElementById('msgAgendamento').classList.remove('sucesso');
  }
}
