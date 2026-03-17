import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import CreateRoom from './pages/CreateRoom';
import JoinRoom from './pages/JoinRoom';
import Room from './pages/Room';
import Host from './pages/Host';
import Listener from './pages/Listener';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen text-white selection:bg-yellow-400/30 selection:text-yellow-900">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/create-room" element={<CreateRoom />} />
          <Route path="/join-room" element={<JoinRoom />} />
          <Route path="/room/:id" element={<Room />} />
          {/* Legacy host route */}
          <Route path="/host" element={<Host />} />
          {/* Listener routes */}
          <Route path="/party/:id" element={<Listener />} />
          <Route path="/join/:id" element={<Listener />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
