// ALMOXARIFADO PROCESSOS - SUPABASE
import React, { useEffect, useRef, useState } from "react";
import {
  Package,
  Plus,
  Search,
  MapPin,
  Camera,
  Minus,
  X,
  AlertTriangle,
  History,
  Trash2,
  ChevronLeft,
  RefreshCw,
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const AREAS = [
  "UHT",
  "LÍQUIDOS",
  "VAF",
  "SOBREMESA",
  "REQUEIJÃO",
  "PGA",
  "RECEPÇÃO",
];

const LOCAIS = [
  "SALA DE PLACAS",
  "SALA DE MOTORES",
  "SALA RECEPÇÃO DE LEITE",
  "OFICINA",
  "ARMÁRIO DO 101",
  "ARMÁRIO UHT",
  "GALPÃO ENVASE",
];

function formularioVazio(area = "UHT") {
  return {
    codigo: "",
    descricao: "",
    categoria: "",
    area,
    tipoLocal: LOCAIS[0],
    local: "",
    quantidade: "1",
    minimo: "0",
    arquivoFoto: null,
    previewFoto: "",
  };
}

function converterItem(item) {
  return {
    id: item.id,
    codigo: item.codigo || "",
    descricao: item.descricao || "",
    categoria: item.categoria || "",
    area: item.area || "",
    tipoLocal: item.tipo_local || "",
    local: item.local_exato || "",
    quantidade: Number(item.quantidade) || 0,
    minimo: Number(item.estoque_minimo) || 0,
    foto: item.foto_url || "",
  };
}

export default function App() {
  const [itens, setItens] = useState([]);
  const [area, setArea] = useState(null);
  const [busca, setBusca] = useState("");
  const [cadastroAberto, setCadastroAberto] = useState(false);
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [historico, setHistorico] = useState([]);
  const [form, setForm] = useState(formularioVazio());
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const fotoRef = useRef(null);

  useEffect(() => {
    carregarItens();
  }, []);

  useEffect(() => {
    return () => {
      if (form.previewFoto) URL.revokeObjectURL(form.previewFoto);
    };
  }, [form.previewFoto]);

  async function carregarItens() {
    setCarregando(true);
    setErro("");

    const { data, error } = await supabase
      .from("itens")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setErro(`Erro ao carregar estoque: ${error.message}`);
    } else {
      setItens((data || []).map(converterItem));
    }

    setCarregando(false);
  }

  function abrirCadastro() {
    setErro("");
    setForm(formularioVazio(area || "UHT"));
    setCadastroAberto(true);
  }

  function fecharCadastro() {
    if (salvando) return;
    setCadastroAberto(false);
    setForm(formularioVazio(area || "UHT"));
  }

  async function cadastrar() {
    if (salvando) return;

    const codigo = String(form.codigo || "").trim();
    const descricao = String(form.descricao || "").trim();

    if (!codigo || !descricao) {
      setErro("Preencha Código e Descrição.");
      return;
    }

    setSalvando(true);
    setErro("");

    try {
      let fotoUrl = "";

      if (form.arquivoFoto) {
        const extensao =
          form.arquivoFoto.name?.split(".").pop()?.toLowerCase() || "jpg";
        const nomeArquivo = `item-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}.${extensao}`;

        const { error: uploadError } = await supabase.storage
          .from("fotos-itens")
          .upload(nomeArquivo, form.arquivoFoto, {
            cacheControl: "3600",
            contentType: form.arquivoFoto.type || undefined,
            upsert: false,
          });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("fotos-itens")
          .getPublicUrl(nomeArquivo);

        fotoUrl = urlData?.publicUrl || "";
      }

      const registro = {
        codigo,
        descricao,
        categoria: String(form.categoria || "").trim(),
        area: form.area,
        tipo_local: form.tipoLocal,
        local_exato: String(form.local || "").trim(),
        quantidade: Math.max(0, Number(form.quantidade) || 0),
        estoque_minimo: Math.max(0, Number(form.minimo) || 0),
        foto_url: fotoUrl,
      };

      const { data, error } = await supabase
        .from("itens")
        .insert(registro)
        .select()
        .single();

      if (error) throw error;

      setItens((lista) => [converterItem(data), ...lista]);
      setCadastroAberto(false);
      setForm(formularioVazio(area || "UHT"));
    } catch (error) {
      setErro(`Erro ao cadastrar: ${error.message || "erro desconhecido"}`);
    } finally {
      setSalvando(false);
    }
  }

  async function movimentar(item, tipo) {
    if (tipo === "saída" && item.quantidade <= 0) return;

    const novaQuantidade =
      tipo === "entrada" ? item.quantidade + 1 : Math.max(0, item.quantidade - 1);

    const { error } = await supabase
      .from("itens")
      .update({ quantidade: novaQuantidade })
      .eq("id", item.id);

    if (error) {
      setErro(`Erro ao atualizar estoque: ${error.message}`);
      return;
    }

    setItens((lista) =>
      lista.map((i) =>
        i.id === item.id ? { ...i, quantidade: novaQuantidade } : i
      )
    );

    setHistorico((lista) => [
      {
        id: `${Date.now()}-${item.id}`,
        item: item.descricao,
        area: item.area,
        tipo,
        data: new Date().toLocaleString("pt-BR"),
      },
      ...lista,
    ]);
  }

  async function excluir(item) {
    if (!window.confirm(`Deseja excluir "${item.descricao}"?`)) return;

    const { error } = await supabase.from("itens").delete().eq("id", item.id);

    if (error) {
      setErro(`Erro ao excluir: ${error.message}`);
      return;
    }

    setItens((lista) => lista.filter((i) => i.id !== item.id));
  }

  function selecionarFoto(evento) {
    const arquivo = evento.target.files?.[0];
    if (!arquivo) return;

    if (!arquivo.type.startsWith("image/")) {
      setErro("Selecione um arquivo de imagem válido.");
      return;
    }

    const preview = URL.createObjectURL(arquivo);
    setForm((atual) => ({
      ...atual,
      arquivoFoto: arquivo,
      previewFoto: preview,
    }));
  }

  function resumo(nomeArea) {
    const lista = itens.filter((item) => item.area === nomeArea);
    return {
      total: lista.length,
      baixo: lista.filter((item) => item.quantidade <= item.minimo).length,
    };
  }

  const itensDaArea = itens.filter((item) => {
    if (item.area !== area) return false;
    const texto = `${item.codigo} ${item.descricao} ${item.categoria} ${item.tipoLocal} ${item.local}`.toLowerCase();
    return texto.includes(busca.trim().toLowerCase());
  });

  return (
    <div>
      <header>
        <div className="wrap top">
          <div className="brand">
            <Package />
            <div>
              <small>CONTROLE DE ESTOQUE</small>
              <h1>ALMOXARIFADO PROCESSOS</h1>
            </div>
          </div>
          <button
            type="button"
            className="dark"
            onClick={() => setHistoricoAberto(true)}
            title="Movimentações"
          >
            <History />
          </button>
        </div>
      </header>

      <main className="wrap">
        {erro && (
          <div
            style={{
              background: "#fee2e2",
              color: "#991b1b",
              fontWeight: 700,
              padding: 12,
              borderRadius: 12,
              marginBottom: 15,
            }}
          >
            {erro}
          </div>
        )}

        {carregando ? (
          <div style={{ textAlign: "center", padding: 50 }}>
            <RefreshCw size={34} />
            <p>Carregando estoque...</p>
          </div>
        ) : !area ? (
          <>
            <h2>Selecione a área</h2>
            <p className="muted">
              Entre em uma área para consultar e movimentar seus materiais.
            </p>

            <div className="areas">
              {AREAS.map((nomeArea) => {
                const dados = resumo(nomeArea);
                return (
                  <button
                    type="button"
                    className="area"
                    key={nomeArea}
                    onClick={() => {
                      setArea(nomeArea);
                      setBusca("");
                    }}
                  >
                    <Package />
                    <h3>{nomeArea}</h3>
                    <span>{dados.total} itens cadastrados</span>
                    {dados.baixo > 0 && (
                      <b>⚠ {dados.baixo} com estoque baixo</b>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <div className="bar">
              <button
                type="button"
                onClick={() => {
                  setArea(null);
                  setBusca("");
                }}
              >
                <ChevronLeft />
              </button>

              <h2>{area}</h2>

              <button type="button" className="primary" onClick={abrirCadastro}>
                <Plus /> Novo item
              </button>
            </div>

            <div className="search">
              <Search />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Pesquisar nesta área..."
              />
            </div>

            <div className="cards">
              {itensDaArea.map((item) => (
                <article key={item.id}>
                  <div
                    className="photo"
                    style={{
                      height: 220,
                      minHeight: 220,
                      maxHeight: 220,
                      overflow: "hidden",
                      background: "#f1f5f9",
                    }}
                  >
                    {item.foto ? (
                      <img
                        src={item.foto}
                        alt={item.descricao}
                        loading="lazy"
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "contain",
                          display: "block",
                        }}
                      />
                    ) : (
                      <Package size={50} />
                    )}

                    <button
                      type="button"
                      className="trash"
                      onClick={() => excluir(item)}
                      title="Excluir item"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div className="body">
                    <small>{item.codigo}</small>
                    <div className="row">
                      <h3>{item.descricao}</h3>
                      <strong>{item.quantidade}</strong>
                    </div>

                    {item.categoria && <p className="muted">{item.categoria}</p>}

                    <p className="location">
                      <MapPin size={15} />
                      <b>{item.tipoLocal}:</b> {item.local || "Não informado"}
                    </p>

                    {item.quantidade <= item.minimo && (
                      <p className="warn">
                        <AlertTriangle size={14} /> Estoque mínimo: {item.minimo}
                      </p>
                    )}

                    <div className="actions">
                      <button
                        type="button"
                        disabled={item.quantidade <= 0}
                        className="out"
                        onClick={() => movimentar(item, "saída")}
                      >
                        <Minus /> Saída
                      </button>
                      <button
                        type="button"
                        className="in"
                        onClick={() => movimentar(item, "entrada")}
                      >
                        <Plus /> Entrada
                      </button>
                    </div>
                  </div>
                </article>
              ))}

              {itensDaArea.length === 0 && (
                <div style={{ textAlign: "center", padding: 40, color: "#64748b" }}>
                  <Package size={45} />
                  <p>Nenhum item nesta área.</p>
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {cadastroAberto && (
        <Modal titulo="Cadastrar item" fechar={fecharCadastro}>
          <button
            type="button"
            className="upload"
            onClick={() => fotoRef.current?.click()}
            style={{ height: 180, overflow: "hidden", background: "#f8fafc" }}
          >
            {form.previewFoto ? (
              <img
                src={form.previewFoto}
                alt="Prévia da foto"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  display: "block",
                }}
              />
            ) : (
              <>
                <Camera /> Adicionar foto
              </>
            )}
          </button>

          <input
            hidden
            ref={fotoRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={selecionarFoto}
          />

          <Campo l="Código *" v={form.codigo} f={(v) => setForm({ ...form, codigo: v })} />
          <Campo
            l="Descrição *"
            v={form.descricao}
            f={(v) => setForm({ ...form, descricao: v })}
          />
          <Campo
            l="Categoria"
            v={form.categoria}
            f={(v) => setForm({ ...form, categoria: v })}
          />
          <Sel l="Área" v={form.area} f={(v) => setForm({ ...form, area: v })} o={AREAS} />

          <div className="box">
            <b>Onde está guardado?</b>
            <Sel
              l="Tipo de local"
              v={form.tipoLocal}
              f={(v) => setForm({ ...form, tipoLocal: v })}
              o={LOCAIS}
            />
            <Campo
              l="Local exato"
              v={form.local}
              f={(v) => setForm({ ...form, local: v })}
            />
          </div>

          <div className="cols">
            <Campo
              l="Quantidade"
              t="number"
              v={form.quantidade}
              f={(v) => setForm({ ...form, quantidade: v })}
            />
            <Campo
              l="Estoque mínimo"
              t="number"
              v={form.minimo}
              f={(v) => setForm({ ...form, minimo: v })}
            />
          </div>

          <button
            type="button"
            className="save"
            disabled={salvando || !form.codigo.trim() || !form.descricao.trim()}
            onClick={cadastrar}
          >
            {salvando ? "SALVANDO..." : "CADASTRAR ITEM"}
          </button>
        </Modal>
      )}

      {historicoAberto && (
        <Modal titulo="Movimentações desta sessão" fechar={() => setHistoricoAberto(false)}>
          {historico.length ? (
            historico.map((movimento) => (
              <div className="movement" key={movimento.id}>
                <b>{movimento.item}</b>
                <span>
                  {movimento.area} • {movimento.tipo} • {movimento.data}
                </span>
              </div>
            ))
          ) : (
            <p className="muted">Sem movimentações nesta sessão.</p>
          )}
        </Modal>
      )}
    </div>
  );
}

function Campo({ l, v, f, t = "text" }) {
  return (
    <label>
      {l}
      <input
        type={t}
        min={t === "number" ? 0 : undefined}
        value={v}
        onChange={(e) => f(e.target.value)}
      />
    </label>
  );
}

function Sel({ l, v, f, o }) {
  return (
    <label>
      {l}
      <select value={v} onChange={(e) => f(e.target.value)}>
        {o.map((opcao) => (
          <option key={opcao} value={opcao}>
            {opcao}
          </option>
        ))}
      </select>
    </label>
  );
}

function Modal({ titulo, fechar, children }) {
  return (
    <div className="overlay">
      <div className="modal">
        <div className="modalhead">
          <h2>{titulo}</h2>
          <button type="button" onClick={fechar}>
            <X />
          </button>
        </div>
        <div className="modalbody">{children}</div>
      </div>
    </div>
  );
}
