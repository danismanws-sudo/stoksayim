import { Suspense } from "react";
import { FullScreenLoader } from "@/components/ui";
import { FieldClient } from "./field-client";

export const metadata = { title: "Sayım" };

export default function FieldPage({
  params,
}: {
  params: Promise<{ opId: string }>;
}) {
  return (
    <Suspense fallback={<FullScreenLoader />}>
      <Resolver params={params} />
    </Suspense>
  );
}

async function Resolver({
  params,
}: {
  params: Promise<{ opId: string }>;
}) {
  const { opId } = await params;
  return <FieldClient operationId={opId} />;
}
