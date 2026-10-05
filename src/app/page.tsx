import { connection } from "next/server";
import { FloodMonitor } from "@/features/flood-map/components/FloodMonitor";
import { getFloodMapData } from "@/features/flood-map/services/flood.service";

export default async function Home() {
  // Datos en vivo: se piden al backend en cada visita, no al compilar.
  await connection();
  const data = await getFloodMapData();

  return (
    <main className="min-h-0 flex-1">
      <h1 className="sr-only">Sistema de alerta temprana de inundaciones para el Ecuador</h1>
      <FloodMonitor data={data} />
    </main>
  );
}
