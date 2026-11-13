"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { CloseIcon, SendIcon, SparklesIcon } from "@/components/ui/icons";
import { satiClientGet } from "@/lib/api/sati-client";

/** Respuesta de GET /situation-analysis: el análisis del momento por partes. */
interface SituationAnalysis {
  /** Lugar analizado, como va tras "en": "Ecuador", "la provincia de Manabí". */
  place: string;
  /** Hora de los datos, ya escrita para mostrar. */
  dataTime: string;
  headline: string;
  observed: string;
  expected: string;
  meaning: string;
  /** Vulnerabilidad del lugar según las capas de exposición y preparación. */
  vulnerability?: string;
  /** "ai": lo redactó Gemini; "template": resumen automático porque la IA no respondió. */
  writer: "ai" | "template";
  sources: string;
  note: string;
  /** Lo que no se pudo leer al generarlo. */
  missing: string[];
}

type State = { status: "idle" } | { status: "loading" } | { status: "done"; analysis: SituationAnalysis } | { status: "error"; message: string };

/** Preguntas que se pueden hacer sobre un análisis: cada una es una consulta a la IA. */
const MAX_QUESTIONS = 2;
/** El mismo límite que valida el backend. */
const QUESTION_MAX_LENGTH = 300;

interface SituationAnalysisCardProps {
  /** Nombre normalizado de la provincia elegida; null = todo el país. */
  provinceKey: string | null;
  /** Nombre para mostrar: "Manabí", "Ecuador". */
  placeName: string;
}

/**
 * "Analizar con IA": a pedido, el backend junta los datos del momento del lugar
 * (pronóstico, lluvia medida, crecidas, ríos y eventos) y Gemini los redacta. No
 * se pide solo: cada análisis es una consulta a la IA. Debajo, hasta dos preguntas
 * sobre ese análisis.
 */
export function SituationAnalysisCard({ provinceKey, placeName }: SituationAnalysisCardProps) {
  const [state, setState] = useState<State>({ status: "idle" });
  const request = useRef<AbortController | null>(null);

  // Al cambiar de provincia el panel lo monta de nuevo (`key`): aquí solo se corta el pedido en curso.
  useEffect(() => () => request.current?.abort(), []);

  const analyze = () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setState({ status: "loading" });
    satiClientGet<SituationAnalysis>("/situation-analysis", provinceKey ? { province: provinceKey } : undefined, controller.signal)
      .then((analysis) => setState({ status: "done", analysis }))
      .catch((reason: Error) => {
        if (reason.name !== "AbortError") setState({ status: "error", message: reason.message });
      });
  };

  const close = () => {
    request.current?.abort();
    setState({ status: "idle" });
  };

  if (state.status === "idle" || state.status === "error") {
    return (
      <div className="space-y-1.5">
        <button
          type="button"
          onClick={analyze}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          <SparklesIcon className="size-4" />
          Analizar con IA la situación de {placeName}
        </button>
        {state.status === "error" && (
          <p role="alert" className="text-[11px] text-red-700">
            No se pudo preparar el análisis: {state.message}. Intenta de nuevo.
          </p>
        )}
      </div>
    );
  }

  return (
    <section aria-label="Análisis con IA" className="rounded-xl bg-indigo-50 p-3 text-xs leading-relaxed text-slate-700 ring-1 ring-indigo-200">
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-indigo-700 uppercase">
          <SparklesIcon className="size-3.5" />
          Análisis con IA · {placeName}
        </p>
        <button
          type="button"
          onClick={close}
          aria-label="Cerrar el análisis"
          className="rounded-md p-1 text-indigo-700 transition hover:bg-indigo-100 focus-visible:outline-2 focus-visible:outline-indigo-600"
        >
          <CloseIcon className="size-3" />
        </button>
      </div>

      {state.status === "loading" ? (
        <Waiting text="Analizando los datos del momento… tarda unos segundos." />
      ) : (
        <div className="space-y-2">
          <div aria-live="polite" className="space-y-2">
            <p className="text-[13px] leading-snug font-semibold text-slate-900">{state.analysis.headline}</p>
            <Part title="Lo medido y reportado" text={state.analysis.observed} />
            <Part title="Lo que se espera" text={state.analysis.expected} />
            <Part title="Qué significa" text={state.analysis.meaning} />
            {state.analysis.vulnerability && <Part title="Vulnerabilidad del lugar" text={state.analysis.vulnerability} />}
          </div>
          <Questions provinceKey={provinceKey} />
          <p className="border-t border-indigo-200 pt-2 text-[10px] leading-relaxed text-slate-500">
            Datos de: {state.analysis.dataTime}. Fuentes: {state.analysis.sources}.
            {state.analysis.missing.length > 0 && ` Sin datos ahora de: ${state.analysis.missing.join(", ")}.`} {state.analysis.note}
          </p>
        </div>
      )}
    </section>
  );
}

interface Exchange {
  question: string;
  /** null = esperando la respuesta. */
  answer: string | null;
  failed?: boolean;
}

/** Hasta dos preguntas sobre el análisis; la IA responde con los mismos datos. Una que falla no cuenta. */
function Questions({ provinceKey }: { provinceKey: string | null }) {
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [draft, setDraft] = useState("");
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  const answered = exchanges.filter((exchange) => !exchange.failed).length;
  const left = MAX_QUESTIONS - answered;
  const waiting = exchanges.some((exchange) => exchange.answer === null);

  const ask = (event: FormEvent) => {
    event.preventDefault();
    const question = draft.trim();
    if (question.length < 3 || waiting || left <= 0) return;
    const controller = new AbortController();
    request.current = controller;
    const index = exchanges.length;
    const settle = (result: Pick<Exchange, "answer" | "failed">) =>
      setExchanges((list) => list.map((exchange, position) => (position === index ? { ...exchange, ...result } : exchange)));
    setExchanges((list) => [...list, { question, answer: null }]);
    setDraft("");
    satiClientGet<{ answer: string }>("/situation-analysis/question", { ...(provinceKey && { province: provinceKey }), question }, controller.signal)
      .then(({ answer }) => settle({ answer }))
      .catch((reason: Error) => {
        if (reason.name !== "AbortError") settle({ answer: `${reason.message}.`, failed: true });
      });
  };

  return (
    <div className="space-y-2 border-t border-indigo-200 pt-2">
      {exchanges.length > 0 && (
        <ul aria-live="polite" className="space-y-2">
          {exchanges.map((exchange, index) => (
            <li key={index} className="space-y-1">
              <p className="ml-6 rounded-lg rounded-br-sm bg-indigo-600 px-2.5 py-1.5 text-white">{exchange.question}</p>
              {exchange.answer === null ? (
                <Waiting text="Buscando en los datos…" />
              ) : (
                <p className={exchange.failed ? "mr-6 rounded-lg rounded-bl-sm bg-red-50 px-2.5 py-1.5 text-red-800 ring-1 ring-red-200" : "mr-6 rounded-lg rounded-bl-sm bg-white px-2.5 py-1.5 ring-1 ring-indigo-200"}>
                  {exchange.answer}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {left > 0 ? (
        <form onSubmit={ask} className="space-y-1">
          <label htmlFor="situation-question" className="block text-[11px] font-semibold text-slate-700">
            ¿Tienes una pregunta sobre este análisis?
          </label>
          <div className="flex gap-1.5">
            <input
              id="situation-question"
              type="text"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={QUESTION_MAX_LENGTH}
              placeholder="Ej.: ¿dónde lloverá más?"
              autoComplete="off"
              className="min-w-0 flex-1 rounded-lg bg-white px-2.5 py-1.5 text-xs text-slate-900 ring-1 ring-indigo-200 placeholder:text-slate-400 focus-visible:outline-2 focus-visible:outline-indigo-600"
            />
            <button
              type="submit"
              disabled={waiting || draft.trim().length < 3}
              aria-label="Enviar la pregunta"
              className="flex shrink-0 items-center justify-center rounded-lg bg-indigo-600 px-2.5 text-white transition hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:bg-indigo-300"
            >
              <SendIcon className="size-3.5" />
            </button>
          </div>
          <p className="text-[10px] text-slate-500">
            {left === MAX_QUESTIONS ? `Puedes hacer hasta ${MAX_QUESTIONS} preguntas.` : "Te queda 1 pregunta."} La IA responde solo con los datos de este análisis.
          </p>
        </form>
      ) : (
        <p className="text-[10px] text-slate-500">Ya hiciste las {MAX_QUESTIONS} preguntas de este análisis. Para más detalle, revisa las capas del mapa.</p>
      )}
    </div>
  );
}

function Waiting({ text }: { text: string }) {
  return (
    <p className="flex items-center gap-2 text-slate-600">
      <span aria-hidden="true" className="size-3 shrink-0 animate-spin rounded-full border-2 border-indigo-300 border-t-indigo-700" />
      {text}
    </p>
  );
}

function Part({ title, text }: { title: string; text: string }) {
  return (
    <p>
      <strong className="font-semibold text-slate-900">{title}:</strong> {text}
    </p>
  );
}
