import { useEffect } from "react";
import { Routing } from "./router/routing";
import { Capacitor } from "@capacitor/core";
import InstallPwaPrompt from "./components/common/InstallPwaPrompt";
import "./App.css";
import "./tablet-responsive.css";
import "./android-core.css"; // Core Android UI/UX adaptations

function App() {
  useEffect(() => {
    // Si estamos en un dispositivo nativo Android, agregar clase al body
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android") {
      document.body.classList.add("is-android");
    } else {
      document.body.classList.remove("is-android");
    }
  }, []);

  return (
    <div className="layout">
      <Routing />
      <InstallPwaPrompt />
    </div>
  );
}

export default App;
