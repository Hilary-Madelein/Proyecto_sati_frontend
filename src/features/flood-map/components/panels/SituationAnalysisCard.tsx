"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { CloseIcon, SendIcon, SparklesIcon } from "@/components/ui/icons";
import { satiClientGet } from "@/lib/api/sati-client";

/** Respuesta de GET /situation-analysis: el titular y los dos párrafos del análisis del momento. */
interface SituationAnalysis {
  /** Lugar analizado, como va tras "en": "Ecuador", "la provincia de Manabí". */
  place: string;
  /** Hora de los datos, ya escrita para mostrar. */
  dataTime: string;
  headline: string;
  /** Primer párrafo: el pronóstico de lluvia y lo que podría afectar (antecedentes, vías, puentes, deslizamientos, vecinos de la misma cuenca). */
  situation: string;
  /** Segundo párrafo: el plan de contingencia con lo que se tiene. */
  plan: string;
  /** Solo con lluvia excepcional: referencia de los episodios anteriores de El Niño (la escribe el sistema, no la IA). */
  reference?: string | null;
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
  /** Nombre normalizado de la provincia elegida, o varias separadas por comas ("loja,manabi"); null = todo el país. */
  provinceKey: string | null;
  /** Nombre para mostrar: "Manabí", "Manabí y Loja", "Ecuador". */
  placeName: string;
}

/**
 * "Analizar con IA": a pedido, el backend junta los datos del momento del lugar
 * (pronóstico, lluvia medida, crecidas, ríos, eventos, antecedentes, red vial,
 * deslizamientos y los vecinos de la misma cuenca) y Gemini los redacta en dos
 * párrafos: qué se espera y qué podría afectar, y el plan de contingencia. No
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
    <section aria-label="Análisis con IA" className="overflow-hidden rounded-2xl bg-indigo-50 text-xs text-slate-700 shadow-sm ring-1 ring-indigo-200">
      <header className="flex items-center justify-between gap-2 bg-indigo-100/80 px-3 py-2">
        <p className="flex min-w-0 items-center gap-1.5 text-[11px] font-semibold text-indigo-700">
          <SparklesIcon className="size-3.5 shrink-0" />
          <span className="truncate">Análisis con IA · {placeName}</span>
        </p>
        <button
          type="button"
          onClick={close}
          aria-label="Cerrar el análisis"
          className="shrink-0 rounded-md p-1 text-indigo-700 transition hover:bg-indigo-100 focus-visible:outline-2 focus-visible:outline-indigo-600"
        >
          <CloseIcon className="size-3" />
        </button>
      </header>

      {state.status === "loading" ? (
        <div className="px-3 py-4">
          <Waiting text="Analizando los datos del momento… tarda unos segundos." />
        </div>
      ) : (
        <div className="space-y-3 px-3 pt-3 pb-3">
          <div aria-live="polite" className="space-y-2">
            <p className="text-[13px] leading-snug font-semibold text-slate-900">{state.analysis.headline}</p>
            <Part title="Pronóstico y posibles afectaciones" text={state.analysis.situation} accent="border-blue-600" />
            <Part title="Plan de contingencia" text={state.analysis.plan} accent="border-red-600" />
            {state.analysis.reference && <Part title="Referencia: episodios anteriores de El Niño" text={state.analysis.reference} accent="border-yellow-400" />}
          </div>
          <Questions provinceKey={provinceKey} />
          <p className="rounded-lg bg-white/60 px-2.5 py-2 text-[10px] leading-relaxed text-slate-500">
            <span className="font-medium text-slate-600">Datos de {state.analysis.dataTime}</span> · {state.analysis.sources}.
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
    <div className="space-y-2 border-t border-indigo-200/70 pt-3">
      {exchanges.length > 0 && (
        <ul aria-live="polite" className="space-y-2">
          {exchanges.map((exchange, index) => (
            <li key={index} className="space-y-1.5">
              <p className="ml-8 rounded-2xl rounded-br-md bg-indigo-600 px-3 py-1.5 text-white">{exchange.question}</p>
              {exchange.answer === null ? (
                <div className="mr-8 rounded-2xl rounded-bl-md bg-white px-3 py-2 shadow-sm">
                  <Waiting text="Buscando en los datos…" />
                </div>
              ) : (
                exchange.failed ? (
                  <p className="mr-8 rounded-2xl rounded-bl-md bg-red-50 px-3 py-2 leading-relaxed text-red-800">{exchange.answer}</p>
                ) : (
                  <Justified className="mr-8 rounded-2xl rounded-bl-md bg-white px-3 py-2 leading-relaxed text-slate-700 shadow-sm">{exchange.answer}</Justified>
                )
              )}
            </li>
          ))}
        </ul>
      )}

      {left > 0 ? (
        <form onSubmit={ask} className="space-y-1.5">
          <label htmlFor="situation-question" className="block text-[11px] font-semibold text-slate-700">
            ¿Tienes una pregunta sobre este análisis?
          </label>
          {/* Campo y botón juntos, como un chat. */}
          <div className="flex items-center gap-1 rounded-full bg-white py-1 pr-1 pl-3 shadow-sm ring-1 ring-indigo-200 focus-within:ring-2 focus-within:ring-indigo-500">
            <input
              id="situation-question"
              type="text"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={QUESTION_MAX_LENGTH}
              placeholder="Ej.: ¿dónde lloverá más?"
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent py-1 text-xs text-slate-900 outline-none placeholder:text-slate-400"
            />
            <button
              type="submit"
              disabled={waiting || draft.trim().length < 3}
              aria-label="Enviar la pregunta"
              className="grid size-7 shrink-0 place-items-center rounded-full bg-indigo-600 text-white transition hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:bg-indigo-200"
            >
              <SendIcon className="size-3.5" />
            </button>
          </div>
          <p className="text-[10px] text-slate-500">
            {left === MAX_QUESTIONS ? `Hasta ${MAX_QUESTIONS} preguntas` : "Te queda 1 pregunta"} · la IA responde solo con los datos de este análisis.
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

/**
 * Una parte del análisis, en su recuadro blanco: título arriba y el texto debajo, con una
 * franja de color en el borde (`accent`: azul el pronóstico, rojo el plan y amarillo la referencia de El Niño).
 */
function Part({ title, text, accent }: { title: string; text: string; accent: string }) {
  return (
    <section className={`rounded-xl border-l-4 bg-white px-3 py-2 shadow-sm ${accent}`}>
      <h4 className="mb-0.5 text-[10px] font-semibold tracking-wide text-slate-500 uppercase">{title}</h4>
      <Justified className="text-[12.5px] leading-relaxed text-slate-700">{text}</Justified>
    </section>
  );
}

/**
 * Texto justificado para columnas angostas: corta con guion solo palabras largas (10
 * letras o más, dejando al menos 5 antes y 4 después), así no quedan huecos grandes
 * entre palabras ni cortes como "to-rrencial".
 */
function Justified({ className, children }: { className: string; children: string }) {
  return (
    <p lang="es" className={`text-justify hyphens-auto [hyphenate-limit-chars:10_5_4] ${className}`}>
      {children}
    </p>
  );
}
