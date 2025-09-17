import { useEffect, useRef } from 'react';

const MyTagCloud = () => {
  const containerRef = useRef(null);

  useEffect(() => {
    // Get window dimensions for responsive sizing
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    // Calculate base radius based on window size - even smaller for very close tags
    const diagonal = Math.sqrt(windowWidth * windowWidth + windowHeight * windowHeight);
    const baseRadius = diagonal * 0.15;
    
    // Technologies to display
    const technologies = [
      'Python', 'TypeScript', 'React', 'Vue.js', 'Node.js', 'Express', 'Next.js',
      'HTML5', 'CSS3', 'SASS', 'LESS', 'Tailwind CSS',
      'Bootstrap', 'Material UI', 'Chakra UI', 'Styled Components',
      'Redux', 'Vuex', 'GraphQL', 'MCP', 'Claude',
      'REST API', 'MongoDB', 'PostgreSQL', 'MySQL', 'Firebase',
      'AWS', 'Google Cloud', 'Docker', 'Kubernetes',
      'CI/CD', 'Git', 'GitHub', 'GitLab', 'Directus',
      'Jest', 'Testing Library', 'MongoDB', 'Mocha', 'Chai',
      'Webpack', 'Babel', 'ESLint', 'Prettier', 'npm',
      'Yarn', 'pnpm', 'Vite', 'Rollup', 'esbuild',
      'Three.js', 'D3.js', 'WebGL', 'Canvas', 'Responsive Design', 'OpenGL',
      'PWA', 'Electron', 'React Native', 'Flutter', 'Swift',
      'Javascript', 'npm', 'npx', 'yarn', 'bun', 'pnpm', 'Conda', 'Ruby', 'PHP', 'Cursor', 'Windsurf',
      'Go', 'C', 'C++', 'ML', 'Computer Vision', 'Ultralytics', 'Mediapipe', 'Tenserflow'
    ];

    // Create tag elements
    const createTags = () => {
      const container = containerRef.current;
      if (!container) return;

      // Clear previous tags
      container.innerHTML = '';

      // Create tags with random positions
      technologies.forEach((tech) => {
        const tag = document.createElement('div');
        tag.className = 'tag';
        tag.textContent = tech;
        
        // Random position - extremely close together
        const angle1 = Math.random() * Math.PI * 2; // Random angle in radians
        const angle2 = Math.random() * Math.PI; // Random angle for elevation
        const radius = baseRadius * (0.9 + Math.random() * 0.2); // 90-110% of base radius
        
        const x = radius * Math.sin(angle2) * Math.cos(angle1);
        const y = radius * Math.sin(angle2) * Math.sin(angle1);
        const z = radius * Math.cos(angle2);
        
        // Apply 3D transform with billboard effect (always face user)
        tag.style.transform = `translate3d(${x}px, ${y}px, ${z}px) rotateY(0deg) rotateX(0deg)`;
        tag.style.transformStyle = 'preserve-3d';
        
        // Random size based on z position (closer = larger) and window size - extremely large
        const baseFontSize = Math.max(32, Math.min(windowWidth, windowHeight) / 20);
        const size = baseFontSize + (z + radius) / (baseRadius / 6);
        tag.style.fontSize = `${size}px`;
        
        // Random color with more vibrant colors
        const hue = Math.floor(Math.random() * 360);
        tag.style.color = `hsl(${hue}, 90%, 75%)`;
        tag.style.textShadow = `0 0 8px rgba(255, 255, 255, 0.5), 0 0 15px hsl(${hue}, 90%, 50%, 0.5)`;
        tag.style.fontWeight = '700';
        
        // Add to container
        container.appendChild(tag);
      });
    };

    // Animation function
    const animate = () => {
      const container = containerRef.current;
      if (!container) return;
      
      let rotationX = 0;
      let rotationY = 0;
      let isMouseDown = false;
      let mouseX, mouseY;
      let lastMouseX, lastMouseY;
      
      // Auto rotation speed - complete rotation every 15 seconds (360° / 15s / 60fps = 0.4°/frame)
      const autoSpeed = 0.4;
      
      // Animation loop
      const animation = () => {
        if (!isMouseDown) {
          // Auto rotation when not interacting
          rotationY += autoSpeed;
        }
        
        // Apply rotation to container
        container.style.transform = `rotateX(${rotationX}deg) rotateY(${rotationY}deg)`;
        
        // Make all tags face the user by applying counter-rotations
        const tags = container.querySelectorAll('.tag');
        tags.forEach(tag => {
          const currentTransform = tag.style.transform;
          const translateMatch = currentTransform.match(/translate3d\([^)]+\)/);
          if (translateMatch) {
            const translatePart = translateMatch[0];
            // Apply counter-rotation to make text always face user
            tag.style.transform = `${translatePart} rotateY(${-rotationY}deg) rotateX(${-rotationX}deg)`;
          }
        });
        
        requestAnimationFrame(animation);
      };
      
      // Mouse/touch interaction
      const handleMouseDown = (e) => {
        isMouseDown = true;
        mouseX = e.clientX;
        mouseY = e.clientY;
        lastMouseX = mouseX;
        lastMouseY = mouseY;
        e.preventDefault();
      };
      
      const handleMouseMove = (e) => {
        if (!isMouseDown) return;
        
        mouseX = e.clientX;
        mouseY = e.clientY;
        
        const deltaX = mouseX - lastMouseX;
        const deltaY = mouseY - lastMouseY;
        
        rotationY += deltaX * 0.5;
        rotationX -= deltaY * 0.5;
        
        lastMouseX = mouseX;
        lastMouseY = mouseY;
      };
      
      const handleMouseUp = () => {
        isMouseDown = false;
      };
      
      // Add event listeners
      document.addEventListener('mousedown', handleMouseDown);
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('mouseleave', handleMouseUp);
      
      // Touch events
      document.addEventListener('touchstart', (e) => {
        handleMouseDown(e.touches[0]);
      });
      
      document.addEventListener('touchmove', (e) => {
        handleMouseMove(e.touches[0]);
      });
      
      document.addEventListener('touchend', handleMouseUp);
      
      // Start animation
      animation();
      
      // Cleanup
      return () => {
        document.removeEventListener('mousedown', handleMouseDown);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('mouseleave', handleMouseUp);
        document.removeEventListener('touchstart', handleMouseDown);
        document.removeEventListener('touchmove', handleMouseMove);
        document.removeEventListener('touchend', handleMouseUp);
      };
    };

    // Initialize
    createTags();
    const cleanupAnimation = animate();

    // Handle window resize with debounce
    let resizeTimeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        createTags();
      }, 200); // Debounce resize events
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimeout);
      if (cleanupAnimation) cleanupAnimation();
    };
  }, []);

  return (
    <div style={{ 
      width: '100vw', 
      height: 'calc(100vh - 80px)', 
      position: 'fixed', 
      top: 0, 
      left: 0, 
      right: 0, 
      bottom: '80px',
      overflow: 'hidden', 
      perspective: '600px',
      margin: 0,
      padding: 0,
      backgroundColor: '#242424',
      zIndex: 0,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center'
    }}>
      <div style={{ 
        width: '100%', 
        height: '100%', 
        position: 'relative',
        transformStyle: 'preserve-3d',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
      }} ref={containerRef}></div>
    </div>
  );
};

export default MyTagCloud;
