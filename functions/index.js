// public/script.js

// =================================================================================
// 1) VARIÁVEIS GLOBAIS E ESTADO DO AGENDAMENTO
// =================================================================================
const API_BASE = "https://us-central1-barbeariaagendamento-1e8c6.cloudfunctions.net";

let listaServicos = [];
let listaProfissionais = [];
let listaTurnos = [];

// Estado global “lightweight” (serviço/data/profissional/horário/dados)
let servicoSelecionado = null;
let dataSelecionada = null;
let profissionalSelecionado = null;
let turnoSelecionado = null;
let nomeCliente = "";
let telefoneCliente = "";

// Referências a elementos estáticos
const btnVoltar = document.getElementById("btnVoltar");
const tituloHeader = document.getElementById("tituloHeader");
const appMain = document.getElementById("appMain");

// Modal (etapas)
const modalAgendamento    = document.getElementById("modalAgendamento");
const btnFecharModal      = document.getElementById("btnFecharModal");
const btnVoltarModal      = document.getElementById("btnVoltarModal");
const btnAvancarModal     = document.getElementById("btnAvancarModal");

const stepData            = document.getElementById("step-data");
const stepProfissional    = document.getElementById("step-profissional");
const stepHorario         = document.getElementById("step-horario");
const stepDados           = document.getElementById("step-dados");

// Calendário no modal (etapa “Data”)
const mesAnoModal         = document.getElementById("mesAnoModal");
const gridDiasModal       = document.getElementById("gridDiasModal");
const prevMesModal        = document.getElementById("prevMesModal");
const nextMesModal        = document.getElementById("nextMesModal");

// Listas dentro do modal
const listaProfissionaisModal = document.getElementById("listaProfissionaisModal");
const listaHorariosModal      = document.getElementById("listaHorariosModal");

// Input de dados do cliente (etapa “Dados”)
const inputNomeModal       = document.getElementById("inputNomeModal");
const inputTelefoneModal   = document.getElementById("inputTelefoneModal");
const erroNomeModal        = document.getElementById("erroNomeModal");
const erroTelefoneModal    = document.getElementById("erroTelefoneModal");

// =================================================================================
// 2) AO CARREGAR A PÁGINA: BUSCAR DADOS E MONTAR A TELA PRINCIPAL
// =================================================================================
document.addEventListener("DOMContentLoaded", async () => {
  await carregarServicos();
  await carregarProfissionais();
  montarTelaPrincipal();
});

// =================================================================================
// 3) BUSCAR DADOS DO FIRESTORE (via suas Cloud Functions)
// =================================================================================
async function carregarServicos() {
  try {
    const resp = await fetch(`${API_BASE}/getServicos`);
    if (!resp.ok) throw new Error("Falha ao buscar serviços");
    listaServicos = await resp.json();
  } catch (err) {
    console.error("Erro carregarServicos:", err);
    appMain.innerHTML = `
      <p style="text-align:center;color:var(--cor-error);margin-top:20px;">
        Não foi possível carregar os serviços. Tente novamente mais tarde.
      </p>`;
  }
}

async function carregarProfissionais() {
  try {
    const resp = await fetch(`${API_BASE}/getProfissionais`);
    if (!resp.ok) throw new Error("Falha ao buscar profissionais");
    listaProfissionais = await resp.json();
  } catch (err) {
    console.error("Erro carregarProfissionais:", err);
    // prosseguimos com listaProfissionais vazia
  }
}

// =================================================================================
// 4) MONTAR TELA PRINCIPAL: HERO + SERVIÇOS POR CATEGORIA
// =================================================================================
function montarTelaPrincipal() {
  // Esvazia <main> para injetar o conteúdo dinamicamente
  appMain.innerHTML = "";

  // 4.1) Hero Section
  const heroHTML = `
    <section id="heroSection" class="hero-container">
      <div class="hero-overlay"></div>
      <div class="hero-content">
        <h2>Agende seu horário em segundos</h2>
        <button id="btnVerServicos" class="btn-primary">VER SERVIÇOS</button>
      </div>
    </section>
  `;
  appMain.insertAdjacentHTML("beforeend", heroHTML);

  // 4.2) Quando o usuário clicar em “VER SERVIÇOS”, rola até a seção de serviços
  document
    .getElementById("btnVerServicos")
    .addEventListener("click", () => {
      const sec = document.querySelector("#servicosSection");
      if (sec) {
        sec.scrollIntoView({ behavior: "smooth" });
      }
    });

  // 4.3) Seção de Serviços organizados por Categoria
  const categorias = ["corte", "barba", "combos"];
  const nomesCategorias = {
    corte: "Cortes",
    barba: "Barbas",
    combos: "Combos"
  };

  let servicosHTML = `<section id="servicosSection" class="servicos-section">`;

  categorias.forEach((cat) => {
    servicosHTML += `
      <div class="categoria-servicos" data-categoria="${cat}">
        <h3 class="titulo-categoria">${nomesCategorias[cat]}</h3>
        <div class="lista-cards" id="cards${cat.charAt(0).toUpperCase() + cat.slice(1)}">
          <!-- Cards de serviços serão inseridos dinamicamente -->
        </div>
      </div>
    `;
  });

  servicosHTML += `</section>`;
  appMain.insertAdjacentHTML("beforeend", servicosHTML);

  // 4.4) Para cada serviço retornado do Firestore, inserimos o card na categoria correta
  listaServicos.forEach((serv) => {
    const cat = serv.categoria || "outros"; // supondo que exista um campo “categoria” no seu docs
    const containerId =
      "cards" + cat.charAt(0).toUpperCase() + cat.slice(1);
    const container = document.getElementById(containerId);
    if (!container) return;

    const precoNum = Number(serv.preco);
    const precoFmt = isNaN(precoNum) ? "0.00" : precoNum.toFixed(2);
    const duracaoNum = Number(serv.duracao_min) || 0;

    const cardHTML = `
      <div class="card-servico" data-id="${serv.id_servico}" data-categoria="${cat}">
        <div class="texto-servico">
          <h4 class="titulo-servico">${serv.nome_servico}</h4>
          <p class="info-servico">${duracaoNum} min • R$ ${precoFmt}</p>
        </div>
        <div class="indicatorserv"></div>
      </div>
    `;
    container.insertAdjacentHTML("beforeend", cardHTML);
  });

  // 4.5) Agora adicionamos o “click” em cada card para abrir o modal de agendamento
  document.querySelectorAll(".card-servico").forEach((card) => {
    card.addEventListener("click", () => {
      const id = card.dataset.id;
      servicoSelecionado = listaServicos.find(
        (s) => s.id_servico === id
      );
      abrirModalAgendamento();
    });
  });
}

// =================================================================================
// 5) ABRIR MODAL DE AGENDAMENTO
//    - Inicializa a etapa “Data” e exibe o modal.
// =================================================================================
function abrirModalAgendamento() {
  // Resetar estado
  dataSelecionada = null;
  profissionalSelecionado = null;
  turnoSelecionado = null;
  nomeCliente = "";
  telefoneCliente = "";

  // Ajustar header do app para exibir o nome do serviço e botão Voltar
  tituloHeader.innerText = servicoSelecionado.nome_servico;
  btnVoltar.classList.remove("hidden");
  btnVoltar.onclick = () => fecharModalAgendamento();

  // Mostrar somente a etapa “Data”
  mostrarEtapaModal("step-data");

  // Renderizar calendário na etapa “Data”
  iniciarCalendarioModal();

  // Exibir modal
  modalAgendamento.classList.remove("hidden");
}

// =================================================================================
// 6) FECHAR MODAL DE AGENDAMENTO
// =================================================================================
function fecharModalAgendamento() {
  modalAgendamento.classList.add("hidden");
  btnVoltar.classList.add("hidden");
  tituloHeader.innerText = "barbear.ai";
}

// =================================================================================
// 7) NAVEGAÇÃO ENTRE ETAPAS DO MODAL
//    - mostrarEtapaModal("step-data"|"step-profissional"|"step-horario"|"step-dados")
// =================================================================================
function mostrarEtapaModal(etapaId) {
  [stepData, stepProfissional, stepHorario, stepDados].forEach((sec) => {
    if (sec.id === etapaId) sec.classList.add("active");
    else sec.classList.remove("active");
  });

  // Configurar botões Voltar / Próximo
  if (etapaId === "step-data") {
    btnVoltarModal.classList.add("hidden");
    btnAvancarModal.innerText = "Próximo";
    btnAvancarModal.classList.add("disabled");
    btnAvancarModal.disabled = true;
  } else {
    btnVoltarModal.classList.remove("hidden");
    // Se for etapa “Horário”, o texto continua “Próximo”
    // Se for etapa “Dados”, o texto passa a “Confirmar”
    btnAvancarModal.innerText =
      etapaId === "step-horario"
        ? "Próximo"
        : etapaId === "step-dados"
        ? "Confirmar"
        : "Próximo";
    btnAvancarModal.classList.add("disabled");
    btnAvancarModal.disabled = true;
  }
}

// =================================================================================
// 8) CALENDÁRIO NO MODAL (etapa “Data”)
// =================================================================================
let mesAtualModal = new Date().getMonth();
let anoAtualModal = new Date().getFullYear();

function iniciarCalendarioModal() {
  renderizarCalendarioModal();
  prevMesModal.onclick = () => {
    if (mesAtualModal > 0) mesAtualModal--;
    else {
      mesAtualModal = 11;
      anoAtualModal--;
    }
    renderizarCalendarioModal();
  };
  nextMesModal.onclick = () => {
    if (mesAtualModal < 11) mesAtualModal++;
    else {
      mesAtualModal = 0;
      anoAtualModal++;
    }
    renderizarCalendarioModal();
  };
}

function renderizarCalendarioModal() {
  mesAnoModal.innerText = obterMesAnoModal();
  gridDiasModal.innerHTML = "";

  const primeiroDia = new Date(anoAtualModal, mesAtualModal, 1).getDay();
  const totalDias = new Date(anoAtualModal, mesAtualModal + 1, 0).getDate();
  const hoje = new Date();

  // 8.1) Preencher “espaços vazios” antes do dia 1
  for (let i = 0; i < primeiroDia; i++) {
    const vazio = document.createElement("div");
    vazio.classList.add("dia-calendario", "disabled");
    gridDiasModal.appendChild(vazio);
  }

  // 8.2) Preencher cada dia do mês
  for (let dia = 1; dia <= totalDias; dia++) {
    const cel = document.createElement("div");
    const dtCompare = new Date(anoAtualModal, mesAtualModal, dia);
    cel.innerText = dia;

    if (
      dtCompare <
      new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
    ) {
      // dias já passados → disabled
      cel.classList.add("dia-calendario", "disabled");
    } else {
      cel.classList.add("dia-calendario", "available");
      cel.addEventListener("click", () => {
        document
          .querySelectorAll(".dia-calendario.available")
          .forEach((d) => d.classList.remove("selected"));
        cel.classList.add("selected");

        const dd = String(dia).padStart(2, "0");
        const mm = String(mesAtualModal + 1).padStart(2, "0");
        dataSelecionada = `${anoAtualModal}-${mm}-${dd}`;

        // Habilita botão Próximo
        btnAvancarModal.classList.remove("disabled");
        btnAvancarModal.disabled = false;
      });
    }
    gridDiasModal.appendChild(cel);
  }
}

function obterMesAnoModal() {
  const meses = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];
  return `${meses[mesAtualModal]} ${anoAtualModal}`;
}

// =================================================================================
// 9) CARREGAR LISTA DE PROFISSIONAIS (etapa “Profissional”)
//    - Filtra por serviçoSelecionado.id_servico
// =================================================================================
function carregarProfissionaisModal() {
  listaProfissionaisModal.innerHTML = "";
  const profsFiltrados = listaProfissionais.filter((p) =>
    Array.isArray(p.servicos_disponiveis) &&
    p.servicos_disponiveis.includes(servicoSelecionado.id_servico)
  );

  if (profsFiltrados.length === 0) {
    listaProfissionaisModal.innerHTML = `
      <p style="text-align:center;color:var(--cor-textoSec);">
        Nenhum profissional disponível para este serviço.
      </p>`;
    btnAvancarModal.classList.add("disabled");
    btnAvancarModal.disabled = true;
    return;
  }

  profsFiltrados.forEach((p) => {
    const item = document.createElement("div");
    item.classList.add("item-profissional");
    item.dataset.id = p.id_profissional;

    item.innerHTML = `
      <img class="avatar" src="${
        p.foto_url || "https://via.placeholder.com/48"
      }" alt="${p.nome_profissional}" />
      <div class="info-prof">
        <h4>${p.nome_profissional}</h4>
        <p>Especialista em …</p>
      </div>
    `;

    item.addEventListener("click", () => {
      // Remove seleção anterior
      document
        .querySelectorAll(".item-profissional")
        .forEach((el) => el.classList.remove("selected"));
      item.classList.add("selected");
      profissionalSelecionado = p;

      // Habilita botão Próximo
      btnAvancarModal.classList.remove("disabled");
      btnAvancarModal.disabled = false;
    });

    listaProfissionaisModal.appendChild(item);
  });
}

// =================================================================================
// 10) CARREGAR HORÁRIOS DO SERVIÇO (etapa “Horário”)
//    - Chama getTurnos?data=<dataSelecionada> e filtra localmente por
//      profissionalSelecionado.id_profissional
// =================================================================================
async function carregarHorariosModal() {
  listaHorariosModal.innerHTML = "";
  try {
    const resp = await fetch(`${API_BASE}/getTurnos?data=${dataSelecionada}`);
    if (!resp.ok) throw new Error("Erro ao buscar turnos");
    const todosTurnos = await resp.json();

    listaTurnos = todosTurnos.filter(
      (t) => t.id_profissional === profissionalSelecionado.id_profissional
    );

    if (listaTurnos.length === 0) {
      listaHorariosModal.innerHTML = `
        <p style="text-align:center;color:var(--cor-textoSec);">
          Sem horários disponíveis.
        </p>`;
      btnAvancarModal.classList.add("disabled");
      btnAvancarModal.disabled = true;
      return;
    }

    listaTurnos.forEach((t) => {
      const btn = document.createElement("button");
      btn.classList.add("btn-horario", "available");
      btn.dataset.id = t.id_turno;
      btn.innerText = t.hora;

      btn.addEventListener("click", () => {
        document
          .querySelectorAll(".btn-horario")
          .forEach((b) => b.classList.remove("selected"));
        btn.classList.add("selected");
        turnoSelecionado = t;

        btnAvancarModal.classList.remove("disabled");
        btnAvancarModal.disabled = false;
      });

      listaHorariosModal.appendChild(btn);
    });
  } catch (err) {
    console.error("Erro carregarHorariosModal:", err);
    listaHorariosModal.innerHTML = `
      <p style="text-align:center;color:var(--cor-error);">
        Não foi possível carregar horários. Tente novamente.
      </p>`;
    btnAvancarModal.classList.add("disabled");
    btnAvancarModal.disabled = true;
  }
}

// =================================================================================
// 11) PRÓXIMO / VOLTAR DENTRO DO MODAL
//    - btnAvancarModal executa ação conforme etapa
//    - btnVoltarModal volta para a etapa anterior
// =================================================================================
btnAvancarModal.addEventListener("click", () => {
  // Se estiver em “step-data”
  if (stepData.classList.contains("active")) {
    mostrarEtapaModal("step-profissional");
    carregarProfissionaisModal();
    btnAvancarModal.classList.add("disabled");
    btnAvancarModal.disabled = true;
    return;
  }

  // Se estiver em “step-profissional”
  if (stepProfissional.classList.contains("active")) {
    mostrarEtapaModal("step-horario");
    carregarHorariosModal();
    btnAvancarModal.classList.add("disabled");
    btnAvancarModal.disabled = true;
    return;
  }

  // Se estiver em “step-horario”
  if (stepHorario.classList.contains("active")) {
    mostrarEtapaModal("step-dados");
    btnAvancarModal.classList.add("disabled");
    btnAvancarModal.disabled = true;
    return;
  }

  // Se estiver em “step-dados” → enviar agendamento
  if (stepDados.classList.contains("active")) {
    enviarAgendamentoModal();
    return;
  }
});

btnVoltarModal.addEventListener("click", () => {
  if (stepProfissional.classList.contains("active")) {
    mostrarEtapaModal("step-data");
    return;
  }
  if (stepHorario.classList.contains("active")) {
    mostrarEtapaModal("step-profissional");
    return;
  }
  if (stepDados.classList.contains("active")) {
    mostrarEtapaModal("step-horario");
    return;
  }
});

// =================================================================================
// 12) VALIDAÇÕES DE DADOS DO CLIENTE (etapa “Dados”)
// =================================================================================
inputNomeModal.addEventListener("input", () => {
  nomeCliente = inputNomeModal.value.trim();
  validarCamposCliente();
});

inputTelefoneModal.addEventListener("input", () => {
  telefoneCliente = inputTelefoneModal.value.replace(/\D/g, "");
  validarCamposCliente();
});

function validarCamposCliente() {
  let valido = true;

  if (nomeCliente.length < 2) {
    erroNomeModal.style.display = "block";
    valido = false;
  } else {
    erroNomeModal.style.display = "none";
  }

  if (!/^\d{10,11}$/.test(telefoneCliente)) {
    erroTelefoneModal.style.display = "block";
    valido = false;
  } else {
    erroTelefoneModal.style.display = "none";
  }

  if (valido) {
    btnAvancarModal.classList.remove("disabled");
    btnAvancarModal.disabled = false;
  } else {
    btnAvancarModal.classList.add("disabled");
    btnAvancarModal.disabled = true;
  }
}

// =================================================================================
// 13) ENVIAR AGENDAMENTO (etapa “Dados”)
// =================================================================================
async function enviarAgendamentoModal() {
  // Desabilita botão e exibe spinner
  btnAvancarModal.disabled = true;
  btnAvancarModal.innerHTML = `
    <span class="spinner"
      style="border:3px solid var(--cor-accent);
             border-top:3px solid rgba(255,255,255,0.2);
             width:18px;height:18px;
             border-radius:50%;
             display:inline-block;
             animation:spin 1s linear infinite;">
    </span>
  `;

  const payload = {
    id_turno: turnoSelecionado.id_turno,
    id_servico: servicoSelecionado.id_servico,
    nome_cliente: nomeCliente,
    telefone_cliente: telefoneCliente
  };

  try {
    const resp = await fetch(`${API_BASE}/postAgendar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!resp.ok) throw new Error("Falha no agendamento");
    const data = await resp.json();
    if (!data.success) throw new Error(data.message || "Erro no agendamento");

    mostrarToastSucesso("Agendamento registrado! Redirecionando…");
    setTimeout(() => {
      window.location.href = data.link_whatsapp;
    }, 1000);
  } catch (err) {
    console.error("Erro enviarAgendamentoModal:", err);
    alert("Erro ao agendar. Tente novamente.");
    btnAvancarModal.disabled = false;
    btnAvancarModal.innerText = "Confirmar";
  }
}

// =================================================================================
// 14) TOAST DE SUCESSO (FIXO)
// =================================================================================
function mostrarToastSucesso(msg) {
  const toast = document.createElement("div");
  toast.classList.add("toast-sucesso");
  toast.innerText = msg;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 2000);
}
