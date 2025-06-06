// public/script.js

// =================================================================================
// 1) VARIÁVEIS GLOBAIS E ESTADO DO AGENDAMENTO
// =================================================================================
const API_BASE = "https://us-central1-barbeariaagendamento-1e8c6.cloudfunctions.net";

let listaServicos = [];
let listaProfissionais = [];
let listaTurnos = [];

// Estado global “lightweight”
let servicoSelecionado = null;
let dataSelecionada = null;
let profissionalSelecionado = null;
let turnoSelecionado = null;
let nomeCliente = "";
let telefoneCliente = "";

// Referências DOM
const btnVoltar      = document.getElementById("btnVoltar");
const tituloHeader   = document.getElementById("tituloHeader");
const appMain        = document.getElementById("appMain");

// Modal (etapas)
const modalAgendamento    = document.getElementById("modalAgendamento");
const btnFecharModal      = document.getElementById("btnFecharModal");
const btnVoltarModal      = document.getElementById("btnVoltarModal");
const btnAvancarModal     = document.getElementById("btnAvancarModal");

const stepData            = document.getElementById("step-data");
const stepProfissional    = document.getElementById("step-profissional");
const stepHorario         = document.getElementById("step-horario");
const stepDados           = document.getElementById("step-dados");

// Calendário no modal
const mesAnoModal         = document.getElementById("mesAnoModal");
const gridDiasModal       = document.getElementById("gridDiasModal");
const prevMesModal        = document.getElementById("prevMesModal");
const nextMesModal        = document.getElementById("nextMesModal");

// Listas dentro do modal
const listaProfissionaisModal = document.getElementById("listaProfissionaisModal");
const listaHorariosModal      = document.getElementById("listaHorariosModal");

// Dados do cliente
const inputNomeModal       = document.getElementById("inputNomeModal");
const inputTelefoneModal   = document.getElementById("inputTelefoneModal");
const erroNomeModal        = document.getElementById("erroNomeModal");
const erroTelefoneModal    = document.getElementById("erroTelefoneModal");

// =================================================================================
// 2) AO CARREGAR A PÁGINA: BUSCAR DADOS E MONTAR A TELA PRINCIPAL
// =================================================================================
document.addEventListener("DOMContentLoaded", async () => {
  console.log("DOM carregado; iniciando fetch de serviços e profissionais...");
  await carregarServicos();
  console.log("SERVIÇOS CARREGADOS (console.log abaixo):");
  console.log(listaServicos);

  await carregarProfissionais();
  console.log("PROFISSIONAIS CARREGADOS:");
  console.log(listaProfissionais);

  montarTelaPrincipal();

  // Depois que o DOM principal foi montado, garantimos que o botão “X” feche o modal:
  btnFecharModal.addEventListener("click", fecharModalAgendamento);
});

// =================================================================================
// 3) BUSCAR DADOS DO FIRESTORE (via Cloud Functions)
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
    listaProfissionais = [];
  }
}

// =================================================================================
// 4) MONTAR TELA PRINCIPAL: HERO + LISTA SIMPLES DE SERVIÇOS
// =================================================================================
function montarTelaPrincipal() {
  appMain.innerHTML = "";

  // 4.1) Hero
  const heroHTML = `
    <section class="hero-container">
      <h2>Agende seu horário em segundos</h2>
      <button id="btnVerServicos" class="btn-primary">VER SERVIÇOS</button>
    </section>
  `;
  appMain.insertAdjacentHTML("beforeend", heroHTML);

  document.getElementById("btnVerServicos").addEventListener("click", () => {
    const sec = document.querySelector("#servicosSection");
    if (sec) sec.scrollIntoView({ behavior: "smooth" });
  });

  // 4.2) Seção de serviços (cria containers fixos)
  let servicosHTML = `
    <section id="servicosSection" class="services-section">
      <div class="container">
        <h3 class="titulo-categoria">Cortes</h3>
        <div class="lista-cards" id="cardsCorte"></div>

        <h3 class="titulo-categoria">Barbas</h3>
        <div class="lista-cards" id="cardsBarba"></div>

        <h3 class="titulo-categoria">Combos</h3>
        <div class="lista-cards" id="cardsCombos"></div>
      </div>
    </section>
  `;
  appMain.insertAdjacentHTML("beforeend", servicosHTML);

  // 4.3) Para cada item em listaServicos, infere categoria via id_servico
  listaServicos.forEach((serv) => {
    const idRaw = (serv.id_servico || "").toString().toLowerCase();
    let cat = "outros";
    if (idRaw.includes("corte")) {
      cat = "corte";
    } else if (idRaw.includes("barba")) {
      cat = "barba";
    } else if (idRaw.includes("combo")) {
      cat = "combos";
    }

    const containerId = "cards" + cat.charAt(0).toUpperCase() + cat.slice(1);
    const container = document.getElementById(containerId);
    if (!container) {
      console.warn(
        `Serviço "${serv.id_servico}" não se encaixa em corte/barba/combos (idRaw="${idRaw}"). Ignorando.`
      );
      return;
    }

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

  // 4.4) Adiciona listener em cada .card-servico
  document.querySelectorAll(".card-servico").forEach((card) => {
    card.addEventListener("click", () => {
      const id = card.dataset.id;
      servicoSelecionado = listaServicos.find((s) => s.id_servico === id);
      console.log("→ Clicou no card, servicoSelecionado =", servicoSelecionado);
      abrirModalAgendamento();
    });
  });
}

// =================================================================================
// 5) ABRIR MODAL DE AGENDAMENTO (DEFINIR PASSO “step-data”)
// =================================================================================
function abrirModalAgendamento() {
  dataSelecionada = null;
  profissionalSelecionado = null;
  turnoSelecionado = null;
  nomeCliente = "";
  telefoneCliente = "";

  console.log("→ abrirModalAgendamento() chamado; serviço:", servicoSelecionado);
  tituloHeader.innerText = servicoSelecionado.nome_servico;
  btnVoltar.classList.remove("hidden");
  btnVoltar.onclick = () => fecharModalAgendamento();

  console.log("→ mostrarEtapaModal('step-data')");
  mostrarEtapaModal("step-data");

  console.log("→ iniciarCalendarioModal()");
  iniciarCalendarioModal();

  console.log("→ exibindo modal");
  modalAgendamento.classList.remove("hidden");
}

// =================================================================================
// 6) FECHAR MODAL
// =================================================================================
function fecharModalAgendamento() {
  modalAgendamento.classList.add("hidden");
  btnVoltar.classList.add("hidden");
  tituloHeader.innerText = "barbear.ai";
}

// =================================================================================
// 7) MOSTRAR APENAS A ETAPA CORRETA (step-data | step-profissional | step-horario | step-dados)
// =================================================================================
function mostrarEtapaModal(etapaId) {
  // Remove .active de todas, adiciona somente ao passo correspondente
  [stepData, stepProfissional, stepHorario, stepDados].forEach((sec) => {
    if (sec.id === etapaId) sec.classList.add("active");
    else sec.classList.remove("active");
  });

  if (etapaId === "step-data") {
    btnVoltarModal.classList.add("hidden");
    btnAvancarModal.innerText = "Próximo";
    btnAvancarModal.classList.add("disabled");
    btnAvancarModal.disabled = true;
  } else {
    btnVoltarModal.classList.remove("hidden");
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
// 8) CALENDÁRIO NO MODAL (PASSO “step-data”)
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

  // 8.1) Preencher “espaços vazios”
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
      // dias passados → disabled
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
        console.log("→ Data selecionada:", dataSelecionada);

        // Habilita “Próximo”
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
// 9) PASSO “step-profissional”: LISTAR PROFISSIONAIS QUE FAZEM O SERVIÇO
// =================================================================================
function carregarProfissionaisModal() {
  console.log("→ carregarProfissionaisModal() para o serviço:", servicoSelecionado.id_servico);
  console.log("   listaProfissionais completa:", listaProfissionais);

  listaProfissionaisModal.innerHTML = "";
  const profsFiltrados = listaProfissionais.filter((p) =>
    Array.isArray(p.servicos_disponiveis) &&
    p.servicos_disponiveis.includes(servicoSelecionado.id_servico)
  );
  console.log("   profsFiltrados:", profsFiltrados);

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
      document
        .querySelectorAll(".item-profissional")
        .forEach((el) => el.classList.remove("selected"));
      item.classList.add("selected");
      profissionalSelecionado = p;
      console.log("→ Profissional selecionado:", profissionalSelecionado);

      btnAvancarModal.classList.remove("disabled");
      btnAvancarModal.disabled = false;
    });

    listaProfissionaisModal.appendChild(item);
  });
}

// =================================================================================
// 10) PASSO “step-horario”: BUSCAR TURNOS E FILTRAR POR PROFISSIONAL
// =================================================================================
async function carregarHorariosModal() {
  listaHorariosModal.innerHTML = "";

  console.log("→ carregarHorariosModal() · dataSelecionada =", dataSelecionada);
  console.log("→ carregarHorariosModal() · id_profissional =", profissionalSelecionado ? profissionalSelecionado.id_profissional : null);

  try {
    const resp = await fetch(`${API_BASE}/getTurnos?data=${dataSelecionada}`);
    if (!resp.ok) throw new Error("Erro ao buscar turnos");

    const todosTurnos = await resp.json();
    console.log("→ getTurnos retornou:", todosTurnos);

    // Vamos comparar em minúsculo para evitar mismatch de caixa
    listaTurnos = todosTurnos.filter(
      (t) =>
        t.id_profissional.toString().toLowerCase() ===
        profissionalSelecionado.id_profissional.toString().toLowerCase()
    );
    console.log("→ listaTurnos filtrada:", listaTurnos);

    if (listaTurnos.length === 0) {
      listaHorariosModal.innerHTML = `
        <p style="text-align:center;color:var(--cor-textoSec);">
          Sem horários disponíveis.
        </p>`;
      btnAvancarModal.classList.add("disabled");
      btnAvancarModal.disabled = true;
      return;
    }

    // Se houver horários, cria botões clicáveis para cada um
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
        console.log("→ Horário selecionado:", turnoSelecionado);

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
// 11) BOTÕES “Próximo” e “Voltar” DENTRO DO MODAL
// =================================================================================
btnAvancarModal.addEventListener("click", () => {
  // Se estiver em “step-data”
  if (stepData.classList.contains("active")) {
    console.log("→ Avançando de step-data para step-profissional");
    mostrarEtapaModal("step-profissional");
    carregarProfissionaisModal();
    btnAvancarModal.classList.add("disabled");
    btnAvancarModal.disabled = true;
    return;
  }

  // Se estiver em “step-profissional”
  if (stepProfissional.classList.contains("active")) {
    console.log("→ Avançando de step-profissional para step-horario");
    mostrarEtapaModal("step-horario");
    carregarHorariosModal();
    btnAvancarModal.classList.add("disabled");
    btnAvancarModal.disabled = true;
    return;
  }

  // Se estiver em “step-horario”
  if (stepHorario.classList.contains("active")) {
    console.log("→ Avançando de step-horario para step-dados");
    mostrarEtapaModal("step-dados");
    btnAvancarModal.classList.add("disabled");
    btnAvancarModal.disabled = true;
    return;
  }

  // Se estiver em “step-dados” → enviar agendamento
  if (stepDados.classList.contains("active")) {
    console.log("→ Enviando agendamento...");
    enviarAgendamentoModal();
    return;
  }
});

btnVoltarModal.addEventListener("click", () => {
  if (stepProfissional.classList.contains("active")) {
    console.log("← Voltando de step-profissional para step-data");
    mostrarEtapaModal("step-data");
    return;
  }
  if (stepHorario.classList.contains("active")) {
    console.log("← Voltando de step-horario para step-profissional");
    mostrarEtapaModal("step-profissional");
    return;
  }
  if (stepDados.classList.contains("active")) {
    console.log("← Voltando de step-dados para step-horario");
    mostrarEtapaModal("step-horario");
    return;
  }
});

// =================================================================================
// 12) VALIDAÇÃO DOS CAMPOS “Nome” e “Telefone” (step-dados)
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
// 13) ENVIAR AGENDAMENTO (step-dados)
// =================================================================================
async function enviarAgendamentoModal() {
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
