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
  LoaderCircle
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
);

const AREAS = [
  "UHT",
  "LÍQUIDOS",
  "VAF",
  "SOBREMESA",
  "REQUEIJÃO",
  "PGA",
  "RECEPÇÃO"
];

const LOCAIS = [
  "SALA DE PLACAS",
  "SALA DE MOTORES",
  "SALA RECEPÇÃO DE LEITE",
  "OFICINA",
  "ARMÁRIO DO 101",
  "ARMÁRIO UHT",
  "GALPÃO ENVASE"
];

const vazio = (area = "UHT") => ({
  codigo: "",
  descricao: "",
  categoria: "",
  area,
  tipoLocal: LOCAIS[0],
  local: "",
  quantidade: "1",
  minimo: "0",
  arquivoFoto: null,
  previewFoto: ""
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

  useEffect(() => {
    carregarItens();
  }, []);

  async function carregarItens() {
    setCarregando(true);
    setErro("");

    const { data, error } = await supabase
      .from("itens")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setErro("Não foi possível carregar o estoque.");
      setCarregando(false);
      return;
    }

    const convertidos = (data || []).map(i => ({
      id: i.id,
      codigo: i.codigo || "",
      descricao: i.descricao || "",
      categoria: i.categoria || "",
      area: i.area || "",
      tipoLocal: i.tipo_local || "",
      local: i.local_exato || "",
      quantidade: Number(i.quantidade) || 0,
      minimo: Number(i.estoque_minimo) || 0,
      foto: i.foto_url || ""
    }));

    setItens(convertidos);
    setCarregando(false);
  }

  const lista = itens.filter(i => {
    if (i.area !== area) return false;

    const texto =
      `${i.codigo} ${i.descricao} ${i.categoria} ${i.tipoLocal} ${i.local}`.toLowerCase();

    return texto.includes(busca.toLowerCase());
  });

  async function cadastrar() {
    if (!form.codigo.trim() || !form.descricao.trim() || salvando) return;

    setSalvando(true);
    setErro("");

    try {
      let fotoUrl = "";

      if (form.arquivoFoto) {
        const extensao =
          form.arquivoFoto.name.split(".").pop()?.toLowerCase() || "jpg";

        const nomeArquivo =
          `${Date.now()}-${Math.random().toString(36).slice(2)}.${extensao}`;

        const { error: uploadError } = await supabase.storage
          .from("fotos-itens")
          .upload(nomeArquivo, form.arquivoFoto, {
            cacheControl: "3600",
            upsert: false
          });

        if (uploadError) {
          throw uploadError;
        }

        const { data: publicData } = supabase.storage
          .from("fotos-itens")
          .getPublicUrl(nomeArquivo);

        fotoUrl = publicData.publicUrl;
      }

      const registro = {
        codigo: form.codigo.trim(),
        descricao: form.descricao.trim(),
        categoria: form.categoria.trim(),
        area: form.area,
        tipo_local: form.tipoLocal,
        local_exato: form.local.trim(),
        quantidade: Math.max(0, Number(form.quantidade) || 0),
        estoque_minimo: Math.max(0, Number(form.minimo) || 0),
        foto_url: fotoUrl
      };

      const { error: insertError } = await supabase
        .from("itens")
        .insert(registro);

      if (insertError) {
        throw insertError;
      }

      setCad(false);
      setForm(vazio(area || "UHT"));
      await carregarItens();
    } catch (e) {
      console.error(e);
      setErro(`Erro ao cadastrar: ${e.message || "verifique a conexão."}`);
    } finally {
      setSalvando(false);
    }
  }

  async function movimento(item, tipo) {
    if (tipo === "saída" && item.quantidade <= 0) return;

    const quantidadeNova =
      tipo === "entrada"
        ? item.quantidade + 1
        : Math.max(0, item.quantidade - 1);

    const { error } = await supabase
      .from("itens")
      .update({ quantidade: quantidadeNova })
      .eq("id", item.id);

    if (error) {
      console.error(error);
      setErro("Não foi possível atualizar o estoque.");
      return;
    }

    setItens(lista =>
      lista.map(i =>
        i.id === item.id
          ? { ...i, quantidade: quantidadeNova }
          : i
      )
    );

    setMov(lista => [
      {
        id: Date.now(),
        item: item.descricao,
        area: item.area,
        tipo,
        data: new Date().toLocaleString("pt-BR")
      },
      ...lista
    ]);
  }

  async function excluir(item) {
    const { error } = await supabase
      .from("itens")
      .delete()
      .eq("id", item.id);

    if (error) {
      console.error(error);
      setErro("Não foi possível excluir o item.");
      return;
    }

    setItens(lista => lista.filter(i => i.id !== item.id));
  }

  function foto(e) {
    const arquivo = e.target.files?.[0];

    if (!arquivo) return;

    const preview = URL.createObjectURL(arquivo);

    setForm(v => ({
      ...v,
      arquivoFoto: arquivo,
      previewFoto: preview
    }));
  }

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

          <button className="dark" onClick={() => setHist(true)}>
            <History />
          </button>
        </div>
      </header>

      <main className="wrap">
        {erro && (
          <div
            style={{
             
