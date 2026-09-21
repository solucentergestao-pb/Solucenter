import './globals.css';
export const metadata={title:'SoluCenter Gestão',description:'Gestão operacional da SoluCenter Climatização & Elétrica'};
export const viewport={width:'device-width',initialScale:1,viewportFit:'cover',themeColor:'#0757b8'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="pt-BR"><body>{children}</body></html>}