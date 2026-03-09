import { Outlet } from 'react-router-dom';
import Header from './Header';
import TabBar from './TabBar';

export default function AppShell() {
  return (
    <div id="app">
      <Header />
      <div id="content">
        <Outlet />
      </div>
      <TabBar />
    </div>
  );
}
