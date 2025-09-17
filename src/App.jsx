import { useState, useEffect } from 'react'
import TagCloud from './components/TagCloud'

function App() {
  // Force full screen layout with maximum aggressive styles
  useEffect(() => {
    // Get actual screen dimensions
    const screenWidth = window.screen.width;
    const screenHeight = window.screen.height;
    
    // Set HTML and body to full screen dimensions
    document.documentElement.style.height = '100vh';
    document.documentElement.style.width = '100vw';
    document.documentElement.style.margin = '0';
    document.documentElement.style.padding = '0';
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.position = 'fixed';
    document.documentElement.style.top = '0';
    document.documentElement.style.left = '0';
    
    document.body.style.height = '100vh';
    document.body.style.width = '100vw';
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = '0';
    document.body.style.left = '0';
    
    // Force root to absolute maximum viewport
    const root = document.getElementById('root');
    root.style.height = '100vh';
    root.style.width = '100vw';
    root.style.margin = '0';
    root.style.padding = '0';
    root.style.overflow = 'hidden';
    root.style.position = 'fixed';
    root.style.top = '0';
    root.style.left = '0';
    root.style.right = '0';
    root.style.bottom = '0';
    root.style.zIndex = '0';
  }, []);

  return (
    <>
      <header style={{ position: 'fixed', top: '10px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000, backgroundColor: 'rgba(36, 36, 36, 0.9)', padding: '1rem', borderRadius: '12px', textAlign: 'center' }}>
        <h1 style={{ margin: 0, fontSize: '2rem', textAlign: 'center', color: '#fff' }}>Jorge Nunes</h1>
        <h2 style={{ margin: '0.5rem 0 0 0', fontSize: '1.2rem', color: '#aaa', textAlign: 'center' }}>Technology Stack</h2>
      </header>
      
      <footer style={{ position: 'fixed', bottom: '10px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000, backgroundColor: 'rgba(36, 36, 36, 0.9)', padding: '0.8rem 1.5rem', borderRadius: '12px', textAlign: 'center' }}>
        <p style={{ margin: 0, fontSize: '0.9rem', color: '#aaa' }}>© 2024 Jorge Nunes - Full Stack Developer</p>
      </footer>
      
      <TagCloud />
    </>
  )
}

export default App
