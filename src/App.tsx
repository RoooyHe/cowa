import "./App.css";
import { HardwareOverview } from "./hardware/HardwareOverview";
import { useCollection } from "./hardware/useCollection";

function App() {
  const state = useCollection();
  return <HardwareOverview state={state} />;
}

export default App;
