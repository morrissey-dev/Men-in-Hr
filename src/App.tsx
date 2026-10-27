import { Route, Routes } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import ScrollReset from './components/ScrollReset';
import Home from './pages/Home';
import About from './pages/About';
import Programme from './pages/Programme';
import Events from './pages/Events';
import GetInvolved from './pages/GetInvolved';
import Contact from './pages/Contact';
import Privacy from './pages/Privacy';
import NotFound from './pages/NotFound';
import Apply from './pages/Apply';
import Admin from './pages/Admin';

export default function App() {
  return <>
    <a href="#main-content" className="skip-link">Skip to main content</a>
    <ScrollReset />
    <Header />
    <main id="main-content">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/programme" element={<Programme />} />
        <Route path="/events" element={<Events />} />
        <Route path="/get-involved" element={<GetInvolved />} />
        <Route path="/apply" element={<Apply />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </main>
    <Footer />
  </>;
}
