// =================================================================================
// 1) VARIÁVEIS GLOBAIS E ESTADO DO AGENDAMENTO
// =================================================================================
const API_BASE = "https://us-central1-barbeariaagendamento-1e8c6.cloudfunctions.net";

let listaServicos = [];
let listaProfissionais = [];
let listaTurnos = [];

const estado = {
  etapa: 1,
  servicoSelecionado: null,
  dataSelecionada: null,
  profissionalSelecionado: null,
  turnoSelecionado: null,
  nomeCliente: "",
  telefoneCliente: ""
};

const btnVoltar = document.getElementById("btnVoltar");
const tituloHeader = document.getElementById("tituloHeader");
const appMain = document.getElementById("appMain");
const btnAcaoFooter = document.getElementById("btnAcaoFooter");

// =================================================================================
// 2) AO CARREGAR PÁGINA: BUSCAR DADOS E MONTAR TELA 1
// =================================================================================
document.addEventListener("DOMContentLoaded", async () => {
  await carregarServicos();
  await carregarProfissionais();
  montarTelaServicos();
});

// =================================================================================
// 3) FUNÇÕES DE BUSCA (SERVIÇOS E PROFISSIONAIS)
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
  }
}

// =================================================================================
// 4) TELA 1: MONTAR CARDS DE SERVIÇOS
// =================================================================================
function montarTelaServicos() {
  estado.etapa = 1;
  btnVoltar.classList.add("hidden");
  tituloHeader.innerText = "Selecione seu serviço";
  btnAcaoFooter.disabled = true;
  btnAcaoFooter.innerText = "Próximo";

  appMain.innerHTML = `
    <section id="secServicos">
      <h2>Serviços Disponíveis</h2>
      <div id="listaServicosContainer">
        ${listaServicos
          .map((serv) => {
            // Garante que 'preco' seja um número antes de chamar toFixed
            const precoNumerico = Number(serv.preco);
            const precoFmt = isNaN(precoNumerico) ? "0.00" : precoNumerico.toFixed(2);
            // Garante que 'duracao_min' seja exibido corretamente (caso venha como string)
            const duracaoFmt = Number(serv.duracao_min) || 0;
            return `
          <div class="card-servico" data-id="${serv.id_servico}">
            <img class="iconServico" src="https://via.placeholder.com/48" alt="${serv.nome_servico}" />
            <div class="texto-servico">
              <h3>${serv.nome_servico}</h3>
              <p>${duracaoFmt} min • R$ ${precoFmt}</p>
            </div>
            <div class="indicatorserv"></div>
          </div>
        `;
          })
          .join("")}
      </div>
    </section>
  `;

  document.querySelectorAll(".card-servico").forEach((card) => {
    card.addEventListener("click", () => {
      const id = card.dataset.id;
      estado.servicoSelecionado = listaServicos.find((s) => s.id_servico === id);
      montarTelaDataProfissional();
    });
  });
}

// =================================================================================
// 5) TELA 2: SELEÇÃO DE DATA E PROFISSIONAL
// =================================================================================
async function montarTelaDataProfissional() {
  estado.etapa = 2;
  estado.dataSelecionada = null;
  estado.profissionalSelecionado = null;
  btnVoltar.classList.remove("hidden");
  btnVoltar.onclick = () => montarTelaServicos();
  tituloHeader.innerText = "Data e Profissional";

  appMain.innerHTML = `
    <div class="calendario-e-profissionais">
      <div class="calendario-container">
        <div class="calendario-header">
          <button id="prevMes">&lt;</button>
          <h4 id="mesAno"></h4>
          <button id="nextMes">&gt;</button>
        </div>
        <div class="dias-semana">
          <div>Dom</div><div>Seg</div><div>Ter</div>
          <div>Qua</div><div>Qui</div><div>Sex</div><div>Sáb</div>
        </div>
        <div class="grid-dias" id="gridDias"></div>
      </div>
      <div class="lista-profissionais" id="listaProfissionaisContainer"></div>
    </div>
  `;

  montarCalendario();

  const servID = estado.servicoSelecionado.id_servico;
  const profsFiltrados = listaProfissionais.filter((p) =>
    Array.isArray(p.servicos_disponiveis) && p.servicos_disponiveis.includes(servID)
  );
  const listaDiv = document.getElementById("listaProfissionaisContainer");

  if (profsFiltrados.length === 0) {
    listaDiv.innerHTML = `
      <p style="text-align:center;color:var(--cor-textoSec);margin:16px;">
        Nenhum profissional atende esse serviço.
      </p>`;
  } else {
    listaDiv.innerHTML = profsFiltrados
      .map(
        (p) => `
      <div class="item-profissional" data-id="${p.id_profissional}">
        <img class="avatar" src="${p.foto_url || "https://via.placeholder.com/48"}" alt="${p.nome_profissional}" />
        <div class="info-prof">
          <h4>${p.nome_profissional}</h4>
          <p>Especialista em …</p>
        </div>
        <div class="seta-direita">›</div>
      </div>
    `
      )
      .join("");

    document.querySelectorAll(".item-profissional").forEach((item) => {
      item.addEventListener("click", () => {
        const idP = item.dataset.id;
        estado.profissionalSelecionado = profsFiltrados.find((x) => x.id_profissional === idP);
        // Se a data já estiver selecionada, podemos avançar automaticamente:
        if (estado.dataSelecionada) {
          montarTelaHorarios();
        } else {
          // Caso contrário, aguardamos o clique no calendário + ativamos o botão
          atualizarFooter(false);
        }
      });
    });
  }

  // Inicialmente, desabilita o botão “Próximo”
  atualizarFooter(false);
}

// =================================================================================
// 6) FUNÇÕES DO CALENDÁRIO
// =================================================================================
let mesAtual = new Date().getMonth();
let anoAtual = new Date().getFullYear();

function obterMesAno() {
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
  return `${meses[mesAtual]} ${anoAtual}`;
}

function montarCalendario() {
  const grid = document.getElementById("gridDias");
  const mesAnoLabel = document.getElementById("mesAno");
  grid.innerHTML = "";
  mesAnoLabel.innerText = obterMesAno();

  const primeiroDia = new Date(anoAtual, mesAtual, 1).getDay();
  const totalDias = new Date(anoAtual, mesAtual + 1, 0).getDate();

  // Preenche os “espaços vazios” antes do dia 1
  for (let i = 0; i < primeiroDia; i++) {
    const vazio = document.createElement("div");
    vazio.classList.add("dia-calendario", "disabled");
    vazio.innerText = "";
    grid.appendChild(vazio);
  }

  // Preenche cada dia do mês
  for (let dia = 1; dia <= totalDias; dia++) {
    const cel = document.createElement("div");
    const hoje = new Date();
    const dtCompare = new Date(anoAtual, mesAtual, dia);

    if (dtCompare < new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())) {
      // dias passados
      cel.classList.add("dia-calendario", "disabled");
      cel.innerText = dia;
    } else {
      // dias disponíveis
      cel.classList.add("dia-calendario", "available");
      cel.innerText = dia;
      cel.addEventListener("click", () => {
        document.querySelectorAll(".dia-calendario.available").forEach((d) =>
          d.classList.remove("selected")
        );
        cel.classList.add("selected");
        const dd = String(dia).padStart(2, "0");
        const mm = String(mesAtual + 1).padStart(2, "0");
        estado.dataSelecionada = `${anoAtual}-${mm}-${dd}`;
        // só habilita “Próximo” se já tiver escolhido um profissional
        const habilitar = estado.profissionalSelecionado !== null;
        atualizarFooter(habilitar);
      });
    }
    grid.appendChild(cel);
  }

  document.getElementById("prevMes").onclick = () => {
    if (mesAtual > 0) mesAtual--;
    else {
      mesAtual = 11;
      anoAtual--;
    }
    montarCalendario();
  };
  document.getElementById("nextMes").onclick = () => {
    if (mesAtual < 11) mesAtual++;
    else {
      mesAtual = 0;
      anoAtual++;
    }
    montarCalendario();
  };
}

// =================================================================================
// 7) TELA 3: SELEÇÃO DE HORÁRIOS
// =================================================================================
async function montarTelaHorarios() {
  estado.etapa = 3;
  estado.turnoSelecionado = null;
  btnVoltar.classList.remove("hidden");
  btnVoltar.onclick = () => montarTelaDataProfissional();
  tituloHeader.innerText = "Escolha o horário";

  // Limpa o container e inicia a busca
  appMain.innerHTML = `
    <div class="lista-horarios" id="listaHorariosContainer"></div>
  `;

  try {
    const dataSel = estado.dataSelecionada;
    const idServ = estado.servicoSelecionado.id_servico;
    const url = `${API_BASE}/getTurnos?data=${dataSel}&idServico=${idServ}`;
    const resp = await fetch(url);

    if (!resp.ok) throw new Error("Erro ao buscar turnos");
    const todosTurnos = await resp.json();

    // Filtra somente os turnos do profissional selecionado
    listaTurnos = todosTurnos.filter(
      (t) => t.id_profissional === estado.profissionalSelecionado.id_profissional
    );
    const container = document.getElementById("listaHorariosContainer");

    if (listaTurnos.length === 0) {
      // Se não houver horários, mostra mensagem + botão “Voltar”
      container.innerHTML = `
        <p style="text-align:center;color:var(--cor-textoSec);margin:16px 0;">
          Sem horários disponíveis
        </p>
        <button id="btnVoltarHorario"
          style="margin:0 auto;display:block;padding:8px 16px;
                 border:1px solid var(--cor-texto);
                 border-radius:20px;
                 color:var(--cor-texto);
                 background:none;">
          Voltar
        </button>
      `;
      document.getElementById("btnVoltarHorario").onclick = () => montarTelaDataProfissional();
      atualizarFooter(false);
      return;
    }

    // Caso haja horários, monta botões para cada um
    container.innerHTML = listaTurnos
      .map(
        (t) => `
      <button class="btn-horario available" data-id="${t.id_turno}">
        ${t.hora}
      </button>
    `
      )
      .join("");

    // Adiciona evento de clique em cada botão de horário
    document.querySelectorAll(".btn-horario.available").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".btn-horario").forEach((b) => b.classList.remove("selected"));
        btn.classList.add("selected");
        const idTurno = btn.dataset.id;
        estado.turnoSelecionado = listaTurnos.find((x) => x.id_turno === idTurno);
        atualizarFooter(true); // habilita próximo, pois já escolheu horário
      });
    });
  } catch (err) {
    console.error("Erro montarTelaHorários:", err);
    appMain.innerHTML = `
      <p style="text-align:center;color:var(--cor-error);margin-top:20px;">
        Não foi possível carregar horários. Tente novamente.
      </p>`;
    atualizarFooter(false);
    return;
  }

  // Ao renderizar a tela, sempre desabilita “Próximo” até o usuário escolher um horário
  atualizarFooter(false);
}

// =================================================================================
// 8) TELA 4: FORMULÁRIO DO CLIENTE
// =================================================================================
function montarTelaDadosCliente() {
  estado.etapa = 4;
  btnVoltar.classList.remove("hidden");
  btnVoltar.onclick = () => montarTelaHorarios();
  tituloHeader.innerText = "Seus Dados";

  appMain.innerHTML = `
    <div class="form-cliente-container">
      <div class="form-cliente-group">
        <input type="text" id="inputNome" />
        <label for="inputNome">Nome completo</label>
        <div class="erro-msg" id="erroNome">Nome obrigatório</div>
      </div>
      <div class="form-cliente-group">
        <input type="tel" id="inputTelefone" />
        <label for="inputTelefone">WhatsApp (somente números)</label>
        <div class="erro-msg" id="erroTelefone">Telefone inválido</div>
      </div>
    </div>
  `;

  const inpNome = document.getElementById("inputNome");
  const inpTel = document.getElementById("inputTelefone");
  const errNome = document.getElementById("erroNome");
  const errTel = document.getElementById("erroTelefone");

  inpNome.addEventListener("input", () => {
    estado.nomeCliente = inpNome.value.trim();
    if (estado.nomeCliente.length < 2) {
      errNome.style.display = "block";
      errNome.innerText = "Nome obrigatório";
      atualizarFooter(false);
    } else {
      errNome.style.display = "none";
      if (validarTelefone(inpTel.value)) atualizarFooter(true);
    }
  });

  inpTel.addEventListener("input", () => {
    estado.telefoneCliente = inpTel.value.replace(/\D/g, "");
    if (!validarTelefone(inpTel.value)) {
      errTel.style.display = "block";
      errTel.innerText = "Telefone inválido";
      atualizarFooter(false);
    } else {
      errTel.style.display = "none";
      if (estado.nomeCliente.length >= 2) atualizarFooter(true);
    }
  });

  // Garante que o botão “Confirmar” comece desabilitado
  atualizarFooter(false);
}

function validarTelefone(tel) {
  const apenasDigitos = tel.replace(/\D/g, "");
  return apenasDigitos.length >= 10 && apenasDigitos.length <= 11;
}

// =================================================================================
// 9) TELA 5: ENVIAR AGENDAMENTO E TOAST
// =================================================================================
async function enviarAgendamento() {
  estado.etapa = 5;
  btnAcaoFooter.disabled = true;
  btnAcaoFooter.innerHTML = `
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
    id_turno: estado.turnoSelecionado.id_turno,
    id_servico: estado.servicoSelecionado.id_servico,
    nome_cliente: estado.nomeCliente,
    telefone_cliente: estado.telefoneCliente
  };

  try {
    const resp = await fetch(`${API_BASE}/postAgendar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!resp.ok) throw new Error("Falha no agendamento");

    const data = await resp.json();
    if (!data.success) throw new Error(data.error || "Falha no agendamento");

    mostrarToastSucesso("Agendamento registrado! Redirecionando…");
    setTimeout(() => {
      window.location.href = data.link_whatsapp;
    }, 1000);
  } catch (err) {
    console.error("Erro ao enviar agendamento:", err);
    mostrarToastErro("Erro ao agendar. Tente novamente.");
    btnAcaoFooter.disabled = false;
    btnAcaoFooter.innerText = "Confirmar";
  }
}

function mostrarToastSucesso(msg) {
  const toast = document.createElement("div");
  toast.classList.add("toast-sucesso");
  toast.innerText = msg;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 2000);
}

function mostrarToastErro(msg) {
  alert(msg);
}

// =================================================================================
// 10) FUNÇÃO RESPONSÁVEL PELO BOTÃO DO FOOTER
// =================================================================================
function atualizarFooter(habilitar) {
  btnAcaoFooter.disabled = !habilitar;

  switch (estado.etapa) {
    case 1:
      btnAcaoFooter.innerText = "Próximo";
      btnAcaoFooter.onclick = montarTelaDataProfissional;
      break;

    case 2:
      btnAcaoFooter.innerText = "Próximo";
      // Só avança se data + profissional já estiverem definidos
      if (habilitar) {
        btnAcaoFooter.onclick = montarTelaHorarios;
      } else {
        btnAcaoFooter.onclick = null;
      }
      break;

    case 3:
      btnAcaoFooter.innerText = "Próximo";
      // Só avança se um horário tiver sido selecionado
      if (habilitar) {
        btnAcaoFooter.onclick = montarTelaDadosCliente;
      } else {
        btnAcaoFooter.onclick = null;
      }
      break;

    case 4:
      btnAcaoFooter.innerText = "Confirmar";
      // Só envia se nome + telefone forem válidos (habilitar===true)
      if (habilitar) {
        btnAcaoFooter.onclick = enviarAgendamento;
      } else {
        btnAcaoFooter.onclick = null;
      }
      break;

    default:
      btnAcaoFooter.innerText = "Próximo";
      btnAcaoFooter.onclick = null;
  }
}

/* Animação spinner (adicionar no CSS caso não esteja):
@keyframes spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
*/
