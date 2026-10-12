import Link from 'next/link';
export function AppShell({children,active='inicio'}:{children:React.ReactNode,active?:string}){
 return <>
  <main className="shell">
   <header className="topbar">
    <Link href="/" className="brand">SOLUCENTER<small>CLIMATIZAÇÃO & ELÉTRICA</small></Link>
    <div className="avatar">SC</div>
   </header>
   {children}
  </main>
  <nav className="bottom">
   <div className="bottomInner">
    <Link className={active==='pecas'?'active':''} href="/catalogos/pecas"><b>▦</b>Peças</Link>
    <Link className={active==='equipamentos'?'active':''} href="/equipamentos"><b>❄</b>Equipamentos</Link>
    <Link className={active==='inicio'?'active':''} href="/"><b>⌂</b>Home</Link>
    <Link className={active==='servicos'?'active':''} href="/catalogos/servicos"><b>🛠</b>Serviços</Link>
    <Link className={active==='clientes'?'active':''} href="/clientes"><b>👥</b>Clientes</Link>
   </div>
  </nav>
 </>;
}
