import { useState, useEffect, useCallback, useRef } from 'react';
import { Timer, Award, RotateCcw, CheckCircle2, XCircle, Play, User, Loader2, Sparkles, LogOut, Trophy, Zap, ShieldCheck, Plus, Pencil, Trash2 } from 'lucide-react';

const TEMPO_PARTIDA_KEY = 'ecoplay-tempo-partida-v1';
const TEMPO_PADRAO_SEGUNDOS = 20;
const PERGUNTAS_PERSONALIZADAS_KEY = 'ecoplay-perguntas-v1';
const SENHA_ADMIN = 'admin123';

const carregarTempoPartida = () => {
  try {
    const tempoSalvo = Number(localStorage.getItem(TEMPO_PARTIDA_KEY));
    return Number.isInteger(tempoSalvo) && tempoSalvo >= 1 && tempoSalvo <= 3600
      ? tempoSalvo
      : TEMPO_PADRAO_SEGUNDOS;
  } catch {
    return TEMPO_PADRAO_SEGUNDOS;
  }
};

const formatarTempo = (tempoSegundos) => {
  const minutos = Math.floor(tempoSegundos / 60);
  const segundosRestantes = tempoSegundos % 60;
  return minutos > 0
    ? `${minutos}:${String(segundosRestantes).padStart(2, '0')}`
    : `${segundosRestantes}s`;
};

const embaralhar = (itens) => {
  const copia = [...itens];

  for (let indice = copia.length - 1; indice > 0; indice -= 1) {
    const indiceAleatorio = Math.floor(Math.random() * (indice + 1));
    [copia[indice], copia[indiceAleatorio]] = [copia[indiceAleatorio], copia[indice]];
  }

  return copia;
};

const criarPerguntasDaPartida = (bancoPerguntas, perguntasAnteriores) => {
  let perguntasEmbaralhadas = embaralhar(bancoPerguntas).map((pergunta) => {
    const opcoesEmbaralhadas = embaralhar(
      pergunta.opcoes.map((texto, indice) => ({
        texto,
        correta: indice === pergunta.correta
      }))
    );

    return {
      ...pergunta,
      opcoes: opcoesEmbaralhadas.map((opcao) => opcao.texto),
      correta: opcoesEmbaralhadas.findIndex((opcao) => opcao.correta)
    };
  });

  const mesmaOrdem = perguntasEmbaralhadas.every(
    (pergunta, indice) => pergunta.id === perguntasAnteriores[indice]?.id
  );

  if (mesmaOrdem && perguntasEmbaralhadas.length > 1) {
    perguntasEmbaralhadas = [
      ...perguntasEmbaralhadas.slice(1),
      perguntasEmbaralhadas[0]
    ];
  }

  return perguntasEmbaralhadas;
};

const carregarPerguntasPersonalizadas = () => {
  try {
    const perguntasSalvas = JSON.parse(localStorage.getItem(PERGUNTAS_PERSONALIZADAS_KEY) || '[]');

    if (!Array.isArray(perguntasSalvas)) return [];

    return perguntasSalvas.filter((pergunta) =>
      pergunta &&
      typeof pergunta.id === 'string' &&
      typeof pergunta.pergunta === 'string' &&
      pergunta.pergunta.trim() &&
      Array.isArray(pergunta.opcoes) &&
      pergunta.opcoes.length === 4 &&
      pergunta.opcoes.every((opcao) => typeof opcao === 'string' && opcao.trim()) &&
      Number.isInteger(pergunta.correta) &&
      pergunta.correta >= 0 &&
      pergunta.correta < pergunta.opcoes.length
    );
  } catch {
    return [];
  }
};

const persistirPerguntasPersonalizadas = (perguntas) => {
  try {
    localStorage.setItem(PERGUNTAS_PERSONALIZADAS_KEY, JSON.stringify(perguntas));
    return true;
  } catch {
    return false;
  }
};

const RANKING_KEY = 'ecoplay-ranking-v1';

const carregarRanking = () => {
  try {
    const rankingSalvo = localStorage.getItem(RANKING_KEY);
    return rankingSalvo ? JSON.parse(rankingSalvo) : [];
  } catch {
    return [];
  }
};

export default function App() {
  const [fase, setFase] = useState('login');
  const [nomeJogador, setNomeJogador] = useState('');
  const [erroNome, setErroNome] = useState(false);
  const [ranking, setRanking] = useState(carregarRanking);
  const [rankingSalvo, setRankingSalvo] = useState(false);
  const [perguntasPersonalizadas, setPerguntasPersonalizadas] = useState(carregarPerguntasPersonalizadas);
  const [perguntaEditandoId, setPerguntaEditandoId] = useState(null);
  const [formPergunta, setFormPergunta] = useState({ pergunta: '', opcoes: ['', '', '', ''], correta: 0 });
  const [erroFormularioPergunta, setErroFormularioPergunta] = useState('');
  const [senhaAdmin, setSenhaAdmin] = useState('');
  const [erroAdmin, setErroAdmin] = useState(false);
  const [tempoPartida, setTempoPartida] = useState(carregarTempoPartida);
  const [tempoPartidaEntrada, setTempoPartidaEntrada] = useState(() => String(tempoPartida));
  const [mensagemTempo, setMensagemTempo] = useState('');
  const [erroTempo, setErroTempo] = useState('');
  const [idsPerguntasUsadas, setIdsPerguntasUsadas] = useState([]);

  const [indicePergunta, setIndicePergunta] = useState(0);
  const [perguntasDaPartida, setPerguntasDaPartida] = useState([]);
  const [pontos, setPontos] = useState(0);
  const [tempo, setTempo] = useState(tempoPartida);
  const [opcaoSelecionada, setOpcaoSelecionada] = useState(null);
  const [respondido, setRespondido] = useState(false);
  const [bonusAcumulado, setBonusAcumulado] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maiorStreak, setMaiorStreak] = useState(0);
  const [fimPorPerguntas, setFimPorPerguntas] = useState(false);
  const avancoTimerRef = useRef(null);

  const perguntasDisponiveis = perguntasPersonalizadas.filter(
    (pergunta) => !idsPerguntasUsadas.includes(pergunta.id)
  );

  const salvarPontuacao = useCallback((pontuacaoFinal) => {
    if (!nomeJogador.trim() || rankingSalvo) return;

    const jogadorAtualizado = {
      id: Date.now(),
      nome: nomeJogador.trim(),
      pontos: pontuacaoFinal,
      data: new Date().toLocaleDateString('pt-BR')
    };
    const melhoresPorJogador = new Map();

    [...ranking, jogadorAtualizado].forEach((jogador) => {
      const chaveNome = jogador.nome.trim().toLocaleLowerCase('pt-BR');
      const melhorResultado = melhoresPorJogador.get(chaveNome);

      if (!melhorResultado || jogador.pontos > melhorResultado.pontos) {
        melhoresPorJogador.set(chaveNome, jogador);
      }
    });

    const novoRanking = [...melhoresPorJogador.values()]
      .sort((a, b) => b.pontos - a.pontos)
      .slice(0, 5);

    setRanking(novoRanking);
    try {
      localStorage.setItem(RANKING_KEY, JSON.stringify(novoRanking));
    } catch {
      // Keep the completed game usable even when browser storage is unavailable.
    }
    setRankingSalvo(true);
  }, [nomeJogador, ranking, rankingSalvo]);

  const abrirGerenciador = (pergunta = null) => {
    setPerguntaEditandoId(pergunta?.id ?? null);
    setFormPergunta(pergunta
      ? { pergunta: pergunta.pergunta, opcoes: [...pergunta.opcoes], correta: pergunta.correta }
      : { pergunta: '', opcoes: ['', '', '', ''], correta: 0 });
    setErroFormularioPergunta('');
  };

  const salvarPergunta = (evento) => {
    evento.preventDefault();

    const pergunta = formPergunta.pergunta.trim();
    const opcoes = formPergunta.opcoes.map((opcao) => opcao.trim());

    if (!pergunta || opcoes.some((opcao) => !opcao)) {
      setErroFormularioPergunta('Preencha a pergunta e as quatro alternativas.');
      return;
    }

    const id = perguntaEditandoId || `personalizada-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const perguntaSalva = { id, pergunta, opcoes, correta: formPergunta.correta };
    const novasPerguntas = perguntaEditandoId
      ? perguntasPersonalizadas.map((item) => item.id === perguntaEditandoId ? perguntaSalva : item)
      : [...perguntasPersonalizadas, perguntaSalva];

    if (!persistirPerguntasPersonalizadas(novasPerguntas)) {
      setErroFormularioPergunta('Não foi possível salvar. Verifique o espaço disponível no navegador.');
      return;
    }

    setPerguntasPersonalizadas(novasPerguntas);
    if (perguntaEditandoId) {
      setIdsPerguntasUsadas((idsUsados) => idsUsados.filter((idUsado) => idUsado !== perguntaEditandoId));
    }
    abrirGerenciador();
  };

  const excluirPergunta = (id) => {
    const novasPerguntas = perguntasPersonalizadas.filter((pergunta) => pergunta.id !== id);

    if (!persistirPerguntasPersonalizadas(novasPerguntas)) {
      setErroFormularioPergunta('Não foi possível excluir a pergunta.');
      return;
    }

    setPerguntasPersonalizadas(novasPerguntas);
    setIdsPerguntasUsadas((idsUsados) => idsUsados.filter((idUsado) => idUsado !== id));
    if (perguntaEditandoId === id) abrirGerenciador();
  };

  const iniciarComTransicao = (reiniciarPerguntas = false) => {
    if (!nomeJogador.trim()) {
      setErroNome(true);
      return;
    }
    const perguntasParaJogar = reiniciarPerguntas
      ? perguntasPersonalizadas
      : perguntasDisponiveis;
    if (perguntasParaJogar.length === 0) return;

    setErroNome(false);
    setRankingSalvo(false);
    setFimPorPerguntas(false);
    if (reiniciarPerguntas) setIdsPerguntasUsadas([]);
    setFase('transicao');
    const perguntasEmbaralhadas = criarPerguntasDaPartida(
      perguntasParaJogar,
      perguntasDaPartida
    );

    setTimeout(() => {
      setPerguntasDaPartida(perguntasEmbaralhadas);
      setIndicePergunta(0);
      setPontos(0);
      setTempo(tempoPartida);
      setOpcaoSelecionada(null);
      setRespondido(false);
      setBonusAcumulado(0);
      setStreak(0);
      setMaiorStreak(0);
      setFase('jogo');
    }, 2000);
  };

  const tratarResposta = useCallback((index) => {
    if (respondido || tempo <= 0) return;

    const perguntaAtual = perguntasDaPartida[indicePergunta];
    const acertou = index === perguntaAtual.correta;
    const pontosGanhos = acertou ? 1 + Math.max(0, streak) : 0;
    const pontuacaoFinal = pontos + pontosGanhos;

    setIdsPerguntasUsadas((idsUsados) =>
      idsUsados.includes(perguntaAtual.id) ? idsUsados : [...idsUsados, perguntaAtual.id]
    );
    setOpcaoSelecionada(index);
    setRespondido(true);

    if (acertou) {
      const novoStreak = streak + 1;
      setStreak(novoStreak);
      setMaiorStreak((maior) => Math.max(maior, novoStreak));
      setPontos((prev) => prev + 1 + Math.max(0, novoStreak - 1));
    } else {
      setStreak(0);
    }

    const bonusTempo = acertou ? 4 : 0;
    setBonusAcumulado(bonusTempo);
    if (bonusTempo > 0) {
      setTempo((tempoAtual) => tempoAtual + bonusTempo);
    }

    avancoTimerRef.current = setTimeout(() => {
      if (indicePergunta + 1 < perguntasDaPartida.length) {
        setIndicePergunta((prev) => prev + 1);
        setOpcaoSelecionada(null);
        setRespondido(false);
        setBonusAcumulado(0);
      } else {
        setFimPorPerguntas(true);
        salvarPontuacao(pontuacaoFinal);
        setFase('resultado');
      }
    }, 1500);
  }, [indicePergunta, perguntasDaPartida, pontos, respondido, salvarPontuacao, streak, tempo]);

  useEffect(() => {
    if (fase !== 'jogo') return;

    const timer = setInterval(() => {
      setTempo((tempoAtual) => Math.max(0, tempoAtual - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [fase]);

  useEffect(() => {
    if (fase !== 'jogo' || tempo > 0) return;

    const timeout = setTimeout(() => {
      clearTimeout(avancoTimerRef.current);
      const perguntaAtual = perguntasDaPartida[indicePergunta];

      if (perguntaAtual) {
        setIdsPerguntasUsadas((idsUsados) =>
          idsUsados.includes(perguntaAtual.id) ? idsUsados : [...idsUsados, perguntaAtual.id]
        );
      }

      setFimPorPerguntas(false);
      salvarPontuacao(pontos);
      setFase('resultado');
    }, 0);
    return () => clearTimeout(timeout);
  }, [fase, indicePergunta, perguntasDaPartida, pontos, salvarPontuacao, tempo]);

  const voltarAoInicio = () => {
    setNomeJogador('');
    setErroNome(false);
    setRankingSalvo(false);
    setFase('login');
    setIndicePergunta(0);
    setPontos(0);
    setTempo(tempoPartida);
    setOpcaoSelecionada(null);
    setRespondido(false);
    setBonusAcumulado(0);
    setIdsPerguntasUsadas([]);
    setStreak(0);
    setMaiorStreak(0);
    setFimPorPerguntas(false);
  };

  const limparRanking = () => {
    localStorage.removeItem(RANKING_KEY);
    setRanking([]);
  };

  const salvarConfiguracaoTempo = (evento) => {
    evento.preventDefault();
    const novoTempo = Number(tempoPartidaEntrada);

    if (!Number.isInteger(novoTempo) || novoTempo < 1 || novoTempo > 3600) {
      setErroTempo('Informe um tempo entre 1 e 3600 segundos.');
      setMensagemTempo('');
      return;
    }

    try {
      localStorage.setItem(TEMPO_PARTIDA_KEY, String(novoTempo));
      setTempoPartida(novoTempo);
      setMensagemTempo('Tempo da partida salvo.');
      setErroTempo('');
    } catch {
      setErroTempo('Não foi possível salvar o tempo neste navegador.');
      setMensagemTempo('');
    }
  };

  const entrarComoAdmin = (evento) => {
    evento.preventDefault();

    if (senhaAdmin !== SENHA_ADMIN) {
      setErroAdmin(true);
      return;
    }

    setErroAdmin(false);
    setSenhaAdmin('');
    abrirGerenciador();
    setFase('admin');
  };

  const sairDoAdmin = () => {
    setFase('login');
    setSenhaAdmin('');
    setErroAdmin(false);
  };

  return (
    <div className="min-h-screen w-full bg-[#071b13] text-slate-100 flex items-center justify-center font-sans select-none relative overflow-hidden">
      {fase === 'login' && (
        <div className="relative w-full min-h-screen flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-1000 scale-105"
            style={{
              backgroundImage: `url('https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=1600&auto=format&fit=crop')`
            }}
          />
          <div className="absolute inset-0 bg-linear-to-t from-[#071b13] via-[#071b13]/85 to-[#10271b]/70 backdrop-blur-xs" />

          <div className="relative z-10 w-full max-w-5xl grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="bg-[#10251a]/90 border border-emerald-900/60 rounded-3xl p-8 shadow-2xl backdrop-blur-md text-center space-y-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500/15 border border-emerald-400/30 rounded-2xl text-emerald-300 shadow-inner">
                <Sparkles className="w-8 h-8 animate-pulse" />
              </div>

              <div className="space-y-2">
                <h1 className="text-3xl font-extrabold text-white tracking-tight">EcoPlay</h1>
                <p className="text-slate-400 text-sm">
                  Digite seu nome abaixo e teste seus conhecimentos ao vivo!
                </p>
              </div>

              <div className="space-y-3 text-left">
                <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Nome do Jogador
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-5 h-5" />
                  </div>
                  <input
                    type="text"
                    maxLength={20}
                    value={nomeJogador}
                    onChange={(e) => {
                      setNomeJogador(e.target.value);
                      if (e.target.value.trim()) setErroNome(false);
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && iniciarComTransicao()}
                    placeholder="Ex: Gabriel"
                    className={`w-full pl-11 pr-4 py-3 bg-[#183427]/90 border ${
                      erroNome ? 'border-rose-500 focus:ring-rose-500' : 'border-emerald-900 focus:border-emerald-400 focus:ring-emerald-500'
                    } rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 text-sm transition-all`}
                  />
                </div>
                {erroNome && (
                  <p className="text-xs text-rose-400 font-medium animate-bounce">
                    * Por favor, digite seu nome para começar!
                  </p>
                )}
                {perguntasDisponiveis.length === 0 && (
                  <p className="text-xs text-amber-200" role="status">
                    {perguntasPersonalizadas.length === 0
                      ? 'Peça ao administrador para cadastrar perguntas e liberar o jogo.'
                      : 'Você já respondeu todas as perguntas cadastradas. Peça ao administrador para adicionar perguntas.'}
                  </p>
                )}
              </div>

              <button
                onClick={iniciarComTransicao}
                disabled={perguntasDisponiveis.length === 0}
                className="w-full bg-emerald-700 hover:bg-emerald-600 active:scale-95 text-white font-bold py-3.5 px-6 rounded-xl shadow-lg shadow-emerald-900/40 transition-all duration-200 flex items-center justify-center gap-2 text-base cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-emerald-700 disabled:active:scale-100"
              >
                <Play className="w-5 h-5 fill-current" />
                <span>Entrar e Jogar</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setErroAdmin(false);
                  setSenhaAdmin('');
                  setFase('admin-login');
                }}
                className="w-full border border-emerald-800 bg-[#183427]/70 hover:bg-emerald-900/60 text-emerald-100 font-semibold py-3 px-5 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Acesso do administrador</span>
              </button>
            </div>

            <div className="bg-[#10251a]/90 border border-emerald-900/60 rounded-3xl p-6 shadow-2xl backdrop-blur-md">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-400" />
                  Ranking local
                </h2>
              </div>

              {ranking.length === 0 ? (
                <div className="text-sm text-slate-400 py-8 text-center">
                  Ainda não há jogadas salvas.
                </div>
              ) : (
                <div className="space-y-3">
                  {ranking.map((jogador, index) => (
                    <div
                      key={jogador.id || `${jogador.nome}-${index}`}
                      className="flex items-center justify-between rounded-xl border border-emerald-900/70 bg-[#183427]/70 px-3 py-2"
                    >
                      <div>
                        <p className="font-semibold text-white">#{index + 1} {jogador.nome}</p>
                        <p className="text-xs text-slate-400">{jogador.data}</p>
                      </div>
                      <span className="text-lg font-black text-amber-300">{jogador.pontos}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {fase === 'admin-login' && (
        <div className="relative w-full min-h-screen flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=1600&auto=format&fit=crop')" }} />
          <div className="absolute inset-0 bg-linear-to-t from-[#071b13] via-[#071b13]/90 to-[#10271b]/75 backdrop-blur-xs" />
          <form onSubmit={entrarComoAdmin} className="relative z-10 w-full max-w-md bg-[#10251a]/95 border border-emerald-900/60 rounded-3xl p-8 shadow-2xl backdrop-blur-md space-y-6">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-emerald-500/15 border border-emerald-400/30 rounded-2xl text-emerald-300">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <h1 className="text-2xl font-extrabold text-white">Acesso do administrador</h1>
            </div>
            <label className="block space-y-2">
              <span className="text-xs font-medium text-slate-300 uppercase tracking-wider">Senha</span>
              <input
                type="password"
                autoComplete="current-password"
                value={senhaAdmin}
                onChange={(evento) => {
                  setSenhaAdmin(evento.target.value);
                  setErroAdmin(false);
                }}
                required
                className="w-full bg-[#183427]/90 border border-emerald-900 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </label>
            {erroAdmin && <p role="alert" className="text-sm text-rose-300">Senha incorreta. Tente novamente.</p>}
            <button type="submit" className="w-full bg-emerald-700 hover:bg-emerald-600 text-white font-bold py-3 px-6 rounded-xl transition-colors">
              Entrar como administrador
            </button>
            <button type="button" onClick={sairDoAdmin} className="w-full border border-emerald-800 text-slate-300 hover:text-white py-2.5 px-6 rounded-xl transition-colors">
              Voltar
            </button>
          </form>
        </div>
      )}

      {fase === 'admin' && (
            <div
              className="fixed inset-0 z-60 bg-[#071b13] p-3 sm:p-6 flex items-center justify-center"
              onMouseDown={(evento) => {
                if (evento.target === evento.currentTarget) sairDoAdmin();
              }}
            >
              <section
                role="main"
                aria-labelledby="gerenciador-perguntas-titulo"
                className="w-full max-w-3xl max-h-[92vh] overflow-y-auto bg-[#10251a] border border-emerald-800 rounded-2xl shadow-2xl p-5 sm:p-7 space-y-6"
              >
                <header className="flex items-start justify-between gap-4">
                  <div>
                    <h2 id="gerenciador-perguntas-titulo" className="text-xl font-bold text-white">
                      Painel do administrador
                    </h2>
                    <p className="text-sm text-slate-400 mt-1">
                      Gerencie as perguntas e o ranking do EcoPlay.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {ranking.length > 0 && (
                      <button
                        type="button"
                        onClick={limparRanking}
                        className="border border-rose-900/70 text-rose-200 hover:bg-rose-950/50 px-3 py-2 rounded-lg text-xs font-semibold"
                      >
                        Limpar ranking
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={sairDoAdmin}
                      aria-label="Sair do administrador"
                      className="p-2 text-slate-300 hover:text-white hover:bg-emerald-900/60 rounded-lg"
                    >
                      <LogOut className="w-5 h-5" />
                    </button>
                  </div>
                </header>

                <form onSubmit={salvarConfiguracaoTempo} className="space-y-3 border-b border-emerald-900 pb-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <label className="block flex-1 space-y-1.5">
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-300">
                        Tempo total da partida (segundos)
                      </span>
                      <input
                        type="number"
                        min="1"
                        max="3600"
                        step="1"
                        value={tempoPartidaEntrada}
                        onChange={(evento) => {
                          setTempoPartidaEntrada(evento.target.value);
                          setMensagemTempo('');
                          setErroTempo('');
                        }}
                        required
                        className="w-full bg-[#183427] border border-emerald-900 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </label>
                    <button
                      type="submit"
                      className="inline-flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-600 text-white font-semibold px-4 py-2.5 rounded-lg text-sm"
                    >
                      <Timer className="w-4 h-4" />
                      Salvar tempo
                    </button>
                  </div>
                  <p className="text-xs text-slate-400">
                    Os acertos continuam acrescentando 4 segundos ao cronômetro.
                  </p>
                  {erroTempo && <p role="alert" className="text-sm text-rose-300">{erroTempo}</p>}
                  {mensagemTempo && <p role="status" className="text-sm text-emerald-300">{mensagemTempo}</p>}
                </form>

                <form onSubmit={salvarPergunta} className="space-y-4 border-b border-emerald-900 pb-6">
                  <h3 className="font-semibold text-emerald-100">
                    {perguntaEditandoId ? 'Editar pergunta' : 'Criar pergunta'}
                  </h3>
                  <label className="block space-y-1.5">
                    <span className="text-xs font-medium uppercase tracking-wide text-slate-300">Pergunta</span>
                    <input
                      value={formPergunta.pergunta}
                      onChange={(evento) => setFormPergunta((atual) => ({ ...atual, pergunta: evento.target.value }))}
                      maxLength={200}
                      required
                      placeholder="Digite o enunciado da pergunta"
                      className="w-full bg-[#183427] border border-emerald-900 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </label>

                  <fieldset className="space-y-2">
                    <legend className="text-xs font-medium uppercase tracking-wide text-slate-300 mb-2">
                      Alternativas (selecione a correta)
                    </legend>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {formPergunta.opcoes.map((opcao, indice) => (
                        <div key={indice} className={`flex items-center gap-2 p-2 rounded-lg border ${
                          formPergunta.correta === indice ? 'border-emerald-500/70 bg-emerald-500/10' : 'border-emerald-950 bg-[#183427]/60'
                        }`}>
                          <input
                            type="radio"
                            name="alternativa-correta"
                            checked={formPergunta.correta === indice}
                            onChange={() => setFormPergunta((atual) => ({ ...atual, correta: indice }))}
                            aria-label={`Marcar alternativa ${String.fromCharCode(65 + indice)} como correta`}
                            className="accent-emerald-400 shrink-0"
                          />
                          <input
                            value={opcao}
                            onChange={(evento) => setFormPergunta((atual) => ({
                              ...atual,
                              opcoes: atual.opcoes.map((valor, indiceOpcao) => indiceOpcao === indice ? evento.target.value : valor)
                            }))}
                            maxLength={160}
                            required
                            placeholder={`Alternativa ${String.fromCharCode(65 + indice)}`}
                            aria-label={`Texto da alternativa ${String.fromCharCode(65 + indice)}`}
                            className="min-w-0 flex-1 bg-transparent px-1 py-1 text-sm text-white placeholder:text-slate-500 focus:outline-none"
                          />
                        </div>
                      ))}
                    </div>
                  </fieldset>

                  {erroFormularioPergunta && (
                    <p role="alert" className="text-sm text-rose-300">{erroFormularioPergunta}</p>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="submit"
                      className="inline-flex items-center gap-2 bg-emerald-700 hover:bg-emerald-600 text-white font-semibold px-4 py-2.5 rounded-lg text-sm"
                    >
                      {perguntaEditandoId ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                      {perguntaEditandoId ? 'Salvar alterações' : 'Adicionar pergunta'}
                    </button>
                    {perguntaEditandoId && (
                      <button
                        type="button"
                        onClick={() => abrirGerenciador()}
                        className="border border-emerald-900 hover:bg-emerald-900/50 text-slate-200 px-4 py-2.5 rounded-lg text-sm"
                      >
                        Cancelar edição
                      </button>
                    )}
                  </div>
                </form>

                <div className="space-y-3">
                  <h3 className="font-semibold text-white">Perguntas cadastradas</h3>
                  {perguntasPersonalizadas.length === 0 ? (
                    <p className="text-sm text-slate-400 py-3">Você ainda não cadastrou perguntas próprias.</p>
                  ) : (
                    <ul className="space-y-2">
                      {perguntasPersonalizadas.map((pergunta) => (
                        <li key={pergunta.id} className="flex items-center justify-between gap-3 bg-[#183427]/70 border border-emerald-950 rounded-lg p-3">
                          <p className="min-w-0 text-sm text-slate-100 wrap-break-word">{pergunta.pergunta}</p>
                          <div className="flex shrink-0 gap-1">
                            <button
                              type="button"
                              onClick={() => abrirGerenciador(pergunta)}
                              aria-label={`Editar pergunta: ${pergunta.pergunta}`}
                              className="p-2 text-emerald-200 hover:bg-emerald-800 rounded-md"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => excluirPergunta(pergunta.id)}
                              aria-label={`Excluir pergunta: ${pergunta.pergunta}`}
                              className="p-2 text-rose-300 hover:bg-rose-900/50 rounded-md"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            </div>
      )}

      {fase === 'transicao' && (
        <div className="fixed inset-0 z-50 bg-[#071b13] flex flex-col items-center justify-center space-y-4 animate-fade-in">
          <Loader2 className="w-12 h-12 text-emerald-400 animate-spin" />
          <div className="text-center space-y-1">
            <h3 className="text-xl font-bold text-white tracking-wide">Preparando o Quiz...</h3>
            <p className="text-sm text-slate-400">
              Boa sorte, <span className="text-emerald-300 font-semibold">{nomeJogador}</span>!
            </p>
          </div>
        </div>
      )}

      {fase === 'jogo' && (
        <div className="w-full max-w-xl bg-[#10251a] border border-emerald-950 rounded-2xl p-6 md:p-8 shadow-2xl mx-4 my-auto space-y-6">
          <div className="space-y-3 border-b border-slate-800 pb-4">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
              <span className="flex items-center gap-1.5 text-emerald-300 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20">
                <User className="w-3.5 h-3.5" />
                {nomeJogador}
              </span>
              <span className="uppercase tracking-wider">
                Pergunta {indicePergunta + 1}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="w-full bg-[#183427] rounded-full h-2 overflow-hidden border border-emerald-950 flex-1">
                <div
                  className="bg-emerald-400 h-full transition-all duration-300"
                  style={{ width: `${Math.min(100, (tempo / tempoPartida) * 100)}%` }}
                />
              </div>

              <div className="flex items-center gap-1.5 text-amber-400 font-mono font-bold bg-amber-400/10 border border-amber-400/20 px-3 py-1 rounded-full text-xs shrink-0">
                <Timer className="w-4 h-4" />
                <span>{formatarTempo(tempo)}</span>
              </div>
            </div>

            <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-slate-400">
              <span className="flex items-center gap-1.5 text-cyan-400">
                <Zap className="w-3.5 h-3.5" />
                Streak {streak}
              </span>
              <span className="text-emerald-300">
                Consumo consciente
              </span>
            </div>

            {bonusAcumulado > 0 && (
              <div className="flex justify-end">
                <span className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide animate-pulse">
                  +{bonusAcumulado}s bônus
                </span>
              </div>
            )}
          </div>

          <h2 className="text-lg md:text-xl font-semibold text-white leading-snug">
            {perguntasDaPartida[indicePergunta].pergunta}
          </h2>

          <div className="grid gap-3">
            {perguntasDaPartida[indicePergunta].opcoes.map((opcao, i) => {
              let estiloBotao = 'border-emerald-950 bg-[#183427]/70 hover:bg-emerald-900/60 text-slate-100';

              if (respondido) {
                if (i === perguntasDaPartida[indicePergunta].correta) {
                  estiloBotao = 'border-emerald-500/60 bg-emerald-500/20 text-emerald-200 font-medium';
                } else if (i === opcaoSelecionada) {
                  estiloBotao = 'border-rose-500/60 bg-rose-500/20 text-rose-200';
                } else {
                  estiloBotao = 'border-emerald-950 bg-[#183427]/30 text-slate-500 opacity-40';
                }
              }

              return (
                <button
                  key={i}
                  disabled={respondido}
                  onClick={() => tratarResposta(i)}
                  className={`w-full text-left p-4 rounded-xl border transition-all duration-200 flex items-center justify-between cursor-pointer ${estiloBotao}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-lg bg-[#183427] border border-emerald-900 flex items-center justify-center text-xs font-bold text-emerald-300">
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span className="text-sm md:text-base">{opcao}</span>
                  </div>
                  {respondido && i === perguntasDaPartida[indicePergunta].correta && (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  )}
                  {respondido && i === opcaoSelecionada && i !== perguntasDaPartida[indicePergunta].correta && (
                    <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {fase === 'resultado' && (
        <div className="w-full max-w-md bg-[#10251a] border border-emerald-950 rounded-3xl p-8 shadow-2xl mx-4 my-auto text-center space-y-6">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-emerald-500/10 border border-emerald-500/30 rounded-3xl text-emerald-300 shadow-inner">
            <Award className="w-10 h-10" />
          </div>

          <div className="space-y-1">
            <h2 className="text-2xl font-extrabold text-white">Fim do Jogo!</h2>
            <p className="text-sm text-slate-400">
              {fimPorPerguntas
                ? 'Você respondeu todas as perguntas inéditas disponíveis.'
                : 'O tempo total do desafio acabou.'}
              {' '}Pontuação de <span className="text-emerald-300 font-semibold">{nomeJogador}</span>.
            </p>
          </div>

          <div className="bg-[#183427]/70 border border-emerald-900/70 rounded-2xl p-5 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Pontuação Final</p>
            <div className="text-4xl font-black text-amber-300 font-mono tracking-tight">
              {pontos} pontos
            </div>
          </div>

          <div className="bg-[#183427]/70 border border-emerald-900/70 rounded-2xl p-4 text-left space-y-3">
            <div className="flex items-center justify-between text-sm text-slate-300">
              <span>Maior streak</span>
              <span className="font-semibold text-white">{maiorStreak}</span>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => iniciarComTransicao(true)}
              disabled={perguntasPersonalizadas.length === 0}
              className="w-full bg-emerald-700 hover:bg-emerald-600 active:scale-95 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-emerald-900/40 transition-all duration-200 flex items-center justify-center gap-2 text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-emerald-700 disabled:active:scale-100"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Jogar Novamente</span>
            </button>

            <button
              onClick={voltarAoInicio}
              className="w-full bg-[#183427] hover:bg-emerald-900 active:scale-95 text-slate-300 hover:text-white font-medium py-2.5 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 text-xs cursor-pointer border border-emerald-900/70"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Trocar de Jogador</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
