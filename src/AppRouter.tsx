import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ScrollToTop } from "./components/ScrollToTop";

import Index from "./pages/Index";
import { NotePage } from "./pages/NotePage";
import { WorksPage } from "./pages/WorksPage";
import { MyNotesPage } from "./pages/MyNotesPage";
import { LegacyNoteRedirect } from "./pages/LegacyNoteRedirect";
import NotFound from "./pages/NotFound";

// Match the Vite `base` (/cwtext/) so routes resolve the same in dev, preview and on GitHub Pages
const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || undefined;

export function AppRouter() {
  return (
    <BrowserRouter basename={basename}>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/note/:slug" element={<NotePage />} />
        <Route path="/works" element={<WorksPage />} />
        <Route path="/my-notes" element={<MyNotesPage />} />
        {/* Old links by Nostr address (/naddr1…) */}
        <Route path="/:nip19" element={<LegacyNoteRedirect />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
export default AppRouter;