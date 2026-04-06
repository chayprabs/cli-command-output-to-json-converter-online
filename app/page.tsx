import { Suspense } from "react";
import { WorkbenchPage } from "@/components/workbench/workbench-page";

export default function HomePage() {
  return (
    <Suspense>
      <WorkbenchPage />
    </Suspense>
  );
}
