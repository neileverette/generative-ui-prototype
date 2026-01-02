/**
 * Blurred gradient background component
 * Creates a soft, colorful backdrop with alternating IBM Blue and Purple circles
 * Circles have varying sizes and subtle floating animation
 */

// Circle configuration with varying sizes
const circles = [
  // Large circles
  { size: 650, left: '5%', top: '-10%', color: 'purple', duration: 25, delay: 0 },
  { size: 700, left: '70%', top: '60%', color: 'blue', duration: 30, delay: 2 },
  // Medium-large circles
  { size: 500, left: '80%', top: '-5%', color: 'blue', duration: 22, delay: 1 },
  { size: 550, left: '-5%', top: '50%', color: 'purple', duration: 28, delay: 3 },
  // Medium circles
  { size: 400, left: '40%', top: '70%', color: 'purple', duration: 20, delay: 4 },
  { size: 380, left: '60%', top: '20%', color: 'blue', duration: 24, delay: 0.5 },
  // Small-medium circles
  { size: 280, left: '25%', top: '15%', color: 'blue', duration: 18, delay: 2.5 },
  { size: 300, left: '85%', top: '40%', color: 'purple', duration: 21, delay: 1.5 },
  // Small circles
  { size: 200, left: '15%', top: '80%', color: 'blue', duration: 16, delay: 3.5 },
  { size: 180, left: '50%', top: '45%', color: 'purple', duration: 19, delay: 4.5 },
  { size: 150, left: '90%', top: '85%', color: 'blue', duration: 15, delay: 0.8 },
  { size: 160, left: '35%', top: '5%', color: 'purple', duration: 17, delay: 2.2 },
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
