// script.js (FRONTEND)

// Substitua abaixo pela URL exata do seu Web App (Apps Script)
const API_BASE = 'https://script.google.com/macros/s/AKfycbwABCDE12345/exec';

document.addEventListener('DOMContentLoaded', () => {
  carregarServicosEProfissionais();
  configurarFormPreCadastro();
  configurarAgendamentoListener();
});

let listaServicosGlob = [];
let listaProfissionaisGlob = [];

function carregarServicosEProfissionais() {
  fetch(`${API_BASE}?action=servicos`)
    .then(res => res.json())
    .then(servicos => {
      if (servicos.error) {
        console.error('Erro ao carregar serviços:', servicos.error);
        return;
      }
      listaServicosGlob = servicos;
      popularListaServicos(servicos);
      popularSelectPre(servicos);
      popularSelectServicoAg(servicos);
    })
    .catch(err => console.error('Erro na requisição de serviços:', err));

  fetch(`${API_BASE}?action=profissionais`)
    .then(res => res.json())
    .then(profissionais => {
      if (profissionais.error) {
        console.error('Erro ao carregar profissionais:', profissionais.error);
        return;
      }
      listaProfissionaisGlob = profissionais;
    })
    .catch(err => console.error('Erro na requisição de profissionais:', err));
}

function popularListaServicos(servicos) {
  const divContainer = document.getElementById('listaServicosContainer');
  divContainer.innerHTML = '';
  servicos.forEach(s => {
    const bloco = document.createElement('div');
    bloco.innerHTML = `<strong>${s.nome_servico}</strong><br>${s.preco} – ${s.duracao_min}min`;
    divContainer.appendChild(bloco);
  });
}

function popularSelectPre(servicos) {
  const select = document.getElementById('selectServPre');
  select.innerHTML = '';
  servicos.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id_servico;
    opt.textContent = s.nome_servico;
    select.appendChild(opt);
  });
}

function popularSelectServicoAg(servicos) {
  const select = document.getElementById('selectServicoAg');
  select.innerHTML = '<option value="">-- Selecione um serviço --</option>';
  servicos.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id_servico;
    opt.textContent = s.nome_servico;
    select.appendChild(opt);
  });
}

function configurarFormPreCadastro() {
  const form = document.getElementById('formPre');
  const msgPre = document.getElementById('msgPre');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const nome = document.getElementById('nomePre').value.trim();
    const tel  = document.getElementById('telPre').value.trim();
    const email= document.getElementById('emailPre').value.trim();
    const idServ= document.getElementById('selectServPre').value;

    if (!nome || !tel || !idServ) {
      msgPre.textContent = 'Preencha nome, telefone e escolha um serviço.';
      return;
    }
    msgPre.textContent = 'Enviando...';

    fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'precadastro',
        payload: {
          nome_cliente: nome,
          telefone_cliente: tel,
          email_cliente: email,
          id_servico_interesse: idServ
        }
      })
    })
    .then(res => res.json())
    .then(json => {
      if (json.success) {
        msgPre.textContent = 'Pré-cadastro enviado com sucesso!';
        form.reset();
      } else {
        msgPre.textContent = 'Erro: ' + (json.error || 'falha desconhecida.');
      }
    })
    .catch(err => {
      console.error('Erro no fetch de pré-cadastro:', err);
      msgPre.textContent = 'Erro ao enviar pré-cadastro.';
    });
  });
}

function configurarAgendamentoListener() {
  const selectServicoAg = document.getElementById('selectServicoAg');
  const selectDataAg    = document.getElementById('selectDataAg');
  const selectProfAg    = document.getElementById('selectProfAg');
  const containerHoras  = document.getElementById('horariosDisponiveisContainer');
  const btnConfirmar    = document.getElementById('btnEnviarAg');
  const msgAg           = document.getElementById('msgAg');

  let turnoSelecionado = null;

  selectServicoAg.addEventListener('change', () => {
    limparAgendamento();
    carregarProfissionaisDisponiveis();
  });
  selectDataAg.addEventListener('change', () => {
    limparAgendamento();
    carregarProfissionaisDisponiveis();
  });

  function limparAgendamento() {
    selectProfAg.innerHTML = '';
    containerHoras.innerHTML = '';
    btnConfirmar.disabled = true;
    turnoSelecionado = null;
    msgAg.textContent = '';
  }

  function carregarProfissionaisDisponiveis() {
    const idServ = selectServicoAg.value;
    if (!idServ) return;

    const profsQueAtendem = listaProfissionaisGlob.filter(p => {
      return p.servicos_disponiveis.includes(idServ);
    });

    selectProfAg.innerHTML = '<option value="">-- Selecione um profissional --</option>';
    profsQueAtendem.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id_profissional;
      opt.textContent = p.nome_profissional;
      selectProfAg.appendChild(opt);
    });

    if (selectDataAg.value) {
      carregarHorariosDisponiveis();
    }
  }

  selectProfAg.addEventListener('change', carregarHorariosDisponiveis);

  function carregarHorariosDisponiveis() {
    const idServ = selectServicoAg.value;
    const dataEscolhida = selectDataAg.value;
    const idProf = selectProfAg.value;

    if (!idServ || !dataEscolhida || !idProf) {
      containerHoras.innerHTML = '';
      return;
    }

    fetch(`${API_BASE}?action=turnos&data=${encodeURIComponent(dataEscolhida)}&idServico=${encodeURIComponent(idServ)}`)
      .then(res => res.json())
      .then(turnos => {
        if (turnos.error) {
          console.error('Erro ao carregar turnos:', turnos.error);
          containerHoras.textContent = 'Erro ao carregar horários.';
          return;
        }
        const turnosFiltrados = turnos.filter(t => t.id_profissional === idProf);
        exibirBotoesHorarios(turnosFiltrados);
      })
      .catch(err => {
        console.error('Falha no fetch de turnos:', err);
        containerHoras.textContent = 'Erro ao carregar horários.';
      });
  }

  function exibirBotoesHorarios(turnos) {
    containerHoras.innerHTML = '';
    turnoSelecionado = null;
    btnConfirmar.disabled = true;
    msgAg.textContent = '';

    if (turnos.length === 0) {
      containerHoras.textContent = 'Nenhum horário disponível para esse profissional neste dia.';
      return;
    }

    turnos.forEach(t => {
      const btnHr = document.createElement('button');
      btnHr.textContent = t.hora;
      btnHr.dataset.idTurno = t.id_turno;
      btnHr.classList.add('hora-btn');
      btnHr.addEventListener('click', () => {
        document.querySelectorAll('#horariosDisponiveisContainer button').forEach(b => {
          b.classList.remove('selecionado');
        });
        btnHr.classList.add('selecionado');
        turnoSelecionado = t.id_turno;
        btnConfirmar.disabled = false;
      });
      containerHoras.appendChild(btnHr);
    });
  }

  btnConfirmar.addEventListener('click', () => {
    const nomeC = document.getElementById('nomeClienteAg').value.trim();
    const telC  = document.getElementById('telClienteAg').value.trim();
    const idServ= selectServicoAg.value;

    if (!turnoSelecionado || !nomeC || !telC || !idServ) {
      msgAg.textContent = 'Preencha todos os campos e selecione um horário.';
      return;
    }
    msgAg.textContent = 'Enviando agendamento...';

    fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'agendamento',
        payload: {
          id_turno: turnoSelecionado,
          id_servico: idServ,
          nome_cliente: nomeC,
          telefone_cliente: telC
        }
      })
    })
    .then(res => res.json())
    .then(json => {
      if (json.success) {
        window.open(json.link_whatsapp, '_blank');
        msgAg.textContent = 'Clique no link do WhatsApp para confirmar.';
        selectServicoAg.value = '';
        selectDataAg.value = '';
        selectProfAg.innerHTML = '';
        containerHoras.innerHTML = '';
        document.getElementById('nomeClienteAg').value = '';
        document.getElementById('telClienteAg').value = '';
        btnConfirmar.disabled = true;
      } else {
        msgAg.textContent = 'Erro ao agendar: ' + (json.error || 'Erro desconhecido');
      }
    })
    .catch(err => {
      console.error('Erro no fetch de agendamento:', err);
      msgAg.textContent = 'Erro ao enviar agendamento.';
    });
  });
}
