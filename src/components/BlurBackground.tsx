/**
 * Blurred gradient background component
 * Creates a soft, colorful backdrop with alternating IBM Blue and Purple circles
 * Circles have varying sizes and subtle floating animation
 */

// Circle configuration with varying sizes - faster animations
const circles = [
  // Large circles
  { size: 650, left: '5%', top: '-10%', color: 'purple', duration: 12, delay: 0 },
  { size: 700, left: '70%', top: '60%', color: 'blue', duration: 15, delay: 1 },
  // Medium-large circles
  { size: 500, left: '80%', top: '-5%', color: 'blue', duration: 11, delay: 0.5 },
  { size: 550, left: '-5%', top: '50%', color: 'purple', duration: 14, delay: 1.5 },
  // Medium circles
  { size: 400, left: '40%', top: '70%', color: 'purple', duration: 10, delay: 2 },
  { size: 380, left: '60%', top: '20%', color: 'blue', duration: 12, delay: 0.3 },
  // Small-medium circles
  { size: 280, left: '25%', top: '15%', color: 'blue', duration: 9, delay: 1.2 },
  { size: 300, left: '85%', top: '40%', color: 'purple', duration: 10, delay: 0.8 },
  // Small circles
  { size: 200, left: '15%', top: '80%', color: 'blue', duration: 8, delay: 1.8 },
  { size: 180, left: '50%', top: '45%', color: 'purple', duration: 9, delay: 2.2 },
  { size: 150, left: '90%', top: '85%', color: 'blue', duration: 7, delay: 0.4 },
  { size: 160, left: '35%', top: '5%', color: 'purple', duration: 8, delay: 1.1 },
  // Extra small circles for variety
  { size: 100, left: '20%', top: '35%', color: 'blue', duration: 6, delay: 0.2 },
  { size: 80, left: '75%', top: '15%', color: 'purple', duration: 5, delay: 0.9 },
  { size: 120, left: '45%', top: '90%', color: 'blue', duration: 7, delay: 1.6 },
  { size: 90, left: '10%', top: '60%', color: 'purple', duration: 5.5, delay: 2.5 },
  { size: 70, left: '55%', top: '30%', color: 'blue', duration: 4.5, delay: 0.6 },
  { size: 110, left: '88%', top: '70%', color: 'purple', duration: 6.5, delay: 1.4 },
  // Tiny accent circles
  { size: 50, left: '30%', top: '55%', color: 'blue', duration: 4, delay: 0.7 },
  { size: 60, left: '65%', top: '80%', color: 'purple', duration: 4.5, delay: 1.9 },
  { size: 45, left: '78%', top: '25%', color: 'blue', duration: 3.5, delay: 2.1 },
  { size: 55, left: '8%', top: '25%', color: 'purple', duration: 4, delay: 0.1 },
];

export function BlurBackground() {
  return (
    <div className="blur-background-container">
      {circles.map((circle, index) => (
        <div
          key={index}
          className={`blur-circle blur-circle-${circle.color === 'purple' ? 'purple' : 'ibm-blue'} blur-circle-animate`}
          style={{
            width: `${circle.size}px`,
            height: `${circle.size}px`,
            left: circle.left,
            top: circle.top,
            animationDuration: `${circle.duration}s`,
            animationDelay: `${circle.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
