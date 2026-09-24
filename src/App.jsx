import React, { useEffect, useRef, useState } from "react";
import { Package, Plus, Search, MapPin, Camera, Minus, X, AlertTriangle, History, Trash2, ChevronLeft, RefreshCw } from "lucide-react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
);

const AREAS = ["UHT", "LÍQUIDOS", "VAF", "SOBREMESA", "REQUEIJÃO", "PGA", "RECEPÇÃO"];
const LOCAIS = ["SALA DE PLACAS", "SALA DE MOTORES", "SALA RECEPÇÃO DE LEITE", "OFICINA", "ARMÁRIO DO 101", "ARMÁRIO UHT", "GALPÃO ENVASE"];

const vazio = (area = "UHT") => ({
  codigo: "", descricao: "", categoria: "", area, tipoLocal: LOCAIS[0], local: "",
  quantidade: "1", minimo: "0", arquivoFoto: null, previewFoto: ""
});

const converter = (i) => ({
  id: i.id, codigo: i.codigo || "", descricao: i.descricao || "", categoria: i.categoria || "",
  area: i.area || "", tipoLocal: i.tipo_local || "", local: i.local_exato || "",
  quantidade: Number(i.quantidade) || 0, minimo: Number(i.estoque_minimo) || 0, foto: i.foto_url || ""
});

export default function App() {
  const [itens, setItens] = useState([]);
  const [area, setArea] = useState(null);
  const [busca, setBusca] = useState("");
  const [cad, setCad] = useState(false);
  const [hist, setHist] = useState(false);
  const [mov, setMov] = useState([]);
  const [form, setForm] = useState(vazio());
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const fotoRef = useRef(null);

  useEffect(() => { carregar(); }, []);

  async function carregar() {
    setCarregando(true); setErro("");
    const { data, error } = await supabase.from("itens").select("*").order("created_at", { ascending: false });
    if (error) setErro("Erro ao carregar estoque: " + error.message);
    else setItens((data || []).map(converter));
    setCarregando(false);
  }

  async function cadastrar() {
    if (salvando || !form.codigo.trim() || !form.descricao.trim()) return;
    setSalvando(true); setErro("");
    try {
      let fotoUrl = "";
      if (form.arquivoFoto) {
        const ext = form.arquivoFoto.name?.split(".").pop()?.toLowerCase() || "jpg";
        const nome = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("fotos-itens").upload(nome, form.arquivoFoto, { upsert: false });
        if (uploadError) throw uploadError;
        fotoUrl = supabase.storage.from("fotos-itens").getPublicUrl(nome).data.publicUrl;
      }
      const registro = {
        codigo: form.codigo.trim(), descricao: form.descricao.trim(), categoria: form.categoria.trim(),
        area: form.area, tipo_local: form.tipoLocal, local_exato: form.local.trim(),
        quantidade: Math.max(0, Number(form.quantidade) || 0),
        estoque_minimo: Math.max(0, Number(form.minimo) || 0), foto_url: fotoUrl
      };
      const { data, error } = await supabase.from("itens").insert(registro).select().single();
      if (error) throw error;
      setItens(p => [converter(data), ...p]);
      if (form.previewFoto) URL.revokeObjectURL(form.previewFoto);
      setForm(vazio(area || "UHT")); setCad(false);
    } catch (e) { setErro("Erro ao cadastrar: " + (e.message || "erro desconhecido")); }
    finally { setSalvando(false); }
  }

  async function movimentar(item, tipo) {
    if (tipo === "saída" && item.quantidade <= 0) return;
    const qtd = tipo === "entrada" ? item.quantidade + 1 : item.quantidade - 1;
    const { error } = await supabase.from("itens").update({ quantidade: qtd }).eq("id", item.id);
    if (error) { setErro("Erro ao atualizar estoque: " + error.message); return; }
    setItens(p => p.map(i => i.id === item.id ? { ...i, quantidade: qtd } : i));
    setMov(p => [{ id: Date.now(), item: item.descricao, area: item.area, tipo, data: new Date().toLocaleString("pt-BR") }, ...p]);
  }

  async function excluir(item) {
    if (!window.confirm(`Excluir o item "${item.descricao}"?`)) return;
    const { error } = await supabase.from("itens").delete().eq("id", item.id);
    if (error) { setErro("Erro ao excluir: " + error.message); return; }
    setItens(p => p.filter(i => i.id !== item.id));
  }

  function selecionarFoto(e) {
    const arquivo = e.target.files?.[0]; if (!arquivo) return;
    if (!arquivo.type.startsWith("image/")) { setErro("Selecione uma imagem válida."); return; }
    if (form.previewFoto) URL.revokeObjectURL(form.previewFoto);
    setForm(v => ({ ...v, arquivoFoto: arquivo, previewFoto: URL.createObjectURL(arquivo) }));
  }

  const lista = itens.filter(i => i.area === area && `${i.codigo} ${i.descricao} ${i.categoria} ${i.tipoLocal} ${i.local}`.toLowerCase().includes(busca.toLowerCase()));
  const resumo = a => { const x = itens.filter(i => i.area === a); return { total: x.length, baixo: x.filter(i => i.quantidade <= i.minimo).length }; };

  return <div>
    <header><div className="wrap top"><div className="brand"><Package/><div><small>CONTROLE DE ESTOQUE</small><h1>ALMOXARIFADO PROCESSOS</h1></div></div><button className="dark" onClick={() => setHist(true)}><History/></button></div></header>
    <main className="wrap">
      {erro && <div style={{background:"#fee2e2",color:"#991b1b",padding:12,borderRadius:10,marginBottom:15,fontWeight:700}}>{erro}</div>}
      {carregando ? <div style={{textAlign:"center",padding:50}}><RefreshCw/><p>Carregando estoque...</p></div> : !area ? <>
        <h2>Selecione a área</h2><p className="muted">Entre em uma área para consultar e movimentar seus materiais.</p>
        <div className="areas">{AREAS.map(a => { const r=resumo(a); return <button className="area" key={a} onClick={() => {setArea(a);setBusca("")}}><Package/><h3>{a}</h3><span>{r.total} itens cadastrados</span>{r.baixo>0 && <b>⚠ {r.baixo} com estoque baixo</b>}</button> })}</div>
      </> : <>
        <div className="bar"><button onClick={() => setArea(null)}><ChevronLeft/></button><h2>{area}</h2><button className="primary" onClick={() => {setForm(vazio(area));setErro("");setCad(true)}}><Plus/> Novo item</button></div>
        <div className="search"><Search/><input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Pesquisar nesta área..."/></div>
        <div className="cards">{lista.map(item => <article key={item.id}>
          <div className="photo">{item.foto ? <img src={item.foto} alt={item.descricao}/> : <Package size={50}/>}<button className="trash" onClick={()=>excluir(item)}><Trash2 size={16}/></button></div>
          <div className="body"><small>{item.codigo}</small><div className="row"><h3>{item.descricao}</h3><strong>{item.quantidade}</strong></div>{item.categoria && <p className="muted">{item.categoria}</p>}<p className="location"><MapPin size={15}/><b>{item.tipoLocal}:</b> {item.local||"Não informado"}</p>{item.quantidade<=item.minimo && <p className="warn"><AlertTriangle size={14}/> Estoque mínimo: {item.minimo}</p>}<div className="actions"><button disabled={item.quantidade<=0} className="out" onClick={()=>movimentar(item,"saída")}><Minus/> Saída</button><button className="in" onClick={()=>movimentar(item,"entrada")}><Plus/> Entrada</button></div></div>
        </article>)}</div>
      </>}
    </main>
    {cad && <Modal titulo="Cadastrar item" fechar={() => !salvando && setCad(false)}>
      <button className="upload" onClick={() => fotoRef.current?.click()}>{form.previewFoto ? <img src={form.previewFoto} alt="Prévia da foto"/> : <><Camera/>Adicionar foto</>}</button>
      <input hidden ref={fotoRef} type="file" accept="image/*" capture="environment" onChange={selecionarFoto}/>
      <Campo l="Código *" v={form.codigo} f={v=>setForm({...form,codigo:v})}/><Campo l="Descrição *" v={form.descricao} f={v=>setForm({...form,descricao:v})}/><Campo l="Categoria" v={form.categoria} f={v=>setForm({...form,categoria:v})}/><Sel l="Área" v={form.area} f={v=>setForm({...form,area:v})} o={AREAS}/>
      <div className="box"><b>Onde está guardado?</b><Sel l="Tipo de local" v={form.tipoLocal} f={v=>setForm({...form,tipoLocal:v})} o={LOCAIS}/><Campo l="Local exato" v={form.local} f={v=>setForm({...form,local:v})}/></div>
      <div className="cols"><Campo l="Quantidade" t="number" v={form.quantidade} f={v=>setForm({...form,quantidade:v})}/><Campo l="Estoque mínimo" t="number" v={form.minimo} f={v=>setForm({...form,minimo:v})}/></div>
      <button className="save" disabled={salvando||!form.codigo.trim()||!form.descricao.trim()} onClick={cadastrar}>{salvando?"SALVANDO...":"CADASTRAR ITEM"}</button>
    </Modal>}
    {hist && <Modal titulo="Movimentações desta sessão" fechar={()=>setHist(false)}>{mov.length ? mov.map(m=><div className="movement" key={m.id}><b>{m.item}</b><span>{m.area} • {m.tipo} • {m.data}</span></div>) : <p className="muted">Sem movimentações nesta sessão.</p>}</Modal>}
  </div>;
}

function Campo({l,v,f,t="text"}) { return <label>{l}<input type={t} min={t==="number"?0:undefined} value={v} onChange={e=>f(e.target.value)}/></label>; }
function Sel({l,v,f,o}) { return <label>{l}<select value={v} onChange={e=>f(e.target.value)}>{o.map(x=><option key={x} value={x}>{x}</option>)}</select></label>; }
function Modal({titulo,fechar,children}) { return <div className="overlay"><div className="modal"><div className="modalhead"><h2>{titulo}</h2><button type="button" onClick={fechar}><X/></button></div><div className="modalbody">{children}</div></div></div>; }
