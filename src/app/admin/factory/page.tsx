import FactoryClient from "./FactoryClient";

// PDF rendering and external AI requests can exceed the platform's default timeout.
export const maxDuration = 60;

export default function FactoryPage() {
  return <FactoryClient />;
}
