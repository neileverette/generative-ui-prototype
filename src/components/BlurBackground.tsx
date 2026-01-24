/**
 * Blurred gradient background component
 * Creates a soft, colorful backdrop with alternating IBM Blue, Deep Blue, and Purple circles
 * Circles have varying sizes and subtle floating animation
 */

// Circle configuration with circular orbit animations
// color: 'purple', 'blue' (IBM Blue), or 'deep-blue' (more saturated, more blur)
// blur: optional, defaults to 100px (deep-blue uses 140px by default). Lower = sharper edges
// dir: 'cw' (clockwise) or 'ccw' (counter-clockwise)
// orbitX/orbitY: orbit radius in pixels (broader = larger values)
const circles = [
  // Large circles - broad orbits
  { size: 650, left: '5%', top: '-10%', color: 'purple', duration: 8, delay: 0, dir: 'cw', orbitX: 120, orbitY: 80 },
  { size: 700, left: '70%', top: '60%', color: 'deep-blue', duration: 14, delay: 0.25, dir: 'ccw', orbitX: 100, orbitY: 90 },
  // Medium-large circles
  { size: 500, left: '80%', top: '-5%', color: 'blue', duration: 16, delay: 0.12, blur: 50, dir: 'cw', orbitX: 90, orbitY: 110 },
  { size: 550, left: '-5%', top: '50%', color: 'purple', duration: 9, delay: 0.4, dir: 'ccw', orbitX: 130, orbitY: 70 },
  // Medium circles
  { size: 400, left: '40%', top: '70%', color: 'purple', duration: 18, delay: 0.5, blur: 45, dir: 'cw', orbitX: 80, orbitY: 100 },
  { size: 380, left: '60%', top: '20%', color: 'deep-blue', duration: 7, delay: 0.08, dir: 'ccw', orbitX: 110, orbitY: 85 },
  // Small-medium circles
  { size: 280, left: '25%', top: '15%', color: 'blue', duration: 6, delay: 0.3, dir: 'cw', orbitX: 95, orbitY: 75 },
  { size: 300, left: '85%', top: '40%', color: 'purple', duration: 15, delay: 0.2, blur: 55, dir: 'ccw', orbitX: 85, orbitY: 95 },
  // Small circles
  { size: 200, left: '15%', top: '80%', color: 'deep-blue', duration: 5, delay: 0.45, dir: 'ccw', orbitX: 70, orbitY: 60 },
  { size: 180, left: '50%', top: '45%', color: 'purple', duration: 20, delay: 0.55, blur: 40, dir: 'cw', orbitX: 65, orbitY: 80 },
  { size: 150, left: '90%', top: '85%', color: 'blue', duration: 4.5, delay: 0.1, dir: 'cw', orbitX: 55, orbitY: 70 },
  { size: 160, left: '35%', top: '5%', color: 'purple', duration: 5.5, delay: 0.28, dir: 'ccw', orbitX: 75, orbitY: 55 },
  // Extra small circles for variety
  { size: 100, left: '20%', top: '35%', color: 'deep-blue', duration: 22, delay: 0.05, dir: 'ccw', orbitX: 50, orbitY: 65 },
  { size: 80, left: '75%', top: '15%', color: 'purple', duration: 3.5, delay: 0.22, dir: 'cw', orbitX: 60, orbitY: 45 },
  { size: 120, left: '45%', top: '90%', color: 'blue', duration: 4, delay: 0.4, dir: 'ccw', orbitX: 55, orbitY: 50 },
  { size: 90, left: '10%', top: '60%', color: 'purple', duration: 3.8, delay: 0.62, dir: 'cw', orbitX: 45, orbitY: 55 },
  { size: 70, left: '55%', top: '30%', color: 'deep-blue', duration: 3.2, delay: 0.15, dir: 'ccw', orbitX: 40, orbitY: 50 },
  { size: 110, left: '88%', top: '70%', color: 'purple', duration: 4.2, delay: 0.35, dir: 'cw', orbitX: 50, orbitY: 40 },
  // Tiny accent circles - quick orbits
  { size: 50, left: '30%', top: '55%', color: 'blue', duration: 2.8, delay: 0.18, dir: 'cw', orbitX: 35, orbitY: 45 },
  { size: 60, left: '65%', top: '80%', color: 'purple', duration: 3, delay: 0.48, dir: 'ccw', orbitX: 40, orbitY: 35 },
  { size: 45, left: '78%', top: '25%', color: 'deep-blue', duration: 2.5, delay: 0.52, dir: 'cw', orbitX: 30, orbitY: 40 },
  { size: 55, left: '8%', top: '25%', color: 'purple', duration: 2.7, delay: 0.02, dir: 'ccw', orbitX: 35, orbitY: 30 },
];

const getColorClass = (color: string) => {
  if (color === 'purple') return 'purple';
  if (color === 'deep-blue') return 'deep-blue';
  return 'ibm-blue';
};

export function BlurBackground() {
  return (
    <div className="blur-background-container">
      {circles.map((circle, index) => (
        <div
          key={index}
          className={`blur-circle blur-circle-${getColorClass(circle.color)} blur-circle-orbit-${circle.dir}`}
          style={{
            width: `${circle.size}px`,
            height: `${circle.size}px`,
            left: circle.left,
            top: circle.top,
            '--orbit-duration': `${circle.duration}s`,
            '--orbit-x': `${circle.orbitX}px`,
            '--orbit-y': `${circle.orbitY}px`,
            animationDelay: `${circle.delay}s`,
            ...(circle.blur && { filter: `blur(${circle.blur}px)` }),
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
