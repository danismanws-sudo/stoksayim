import { Suspense } from "react";
import { FullScreenLoader } from "@/components/ui";
import { JoinClient } from "./join-client";

export const metadata = { title: "Sayıma katıl" };

export default function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return (
    <Suspense fallback={<FullScreenLoader />}>
      <JoinResolver params={params} />
    </Suspense>
  );
}

async function JoinResolver({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <JoinClient token={decodeURIComponent(token)} />;
}
