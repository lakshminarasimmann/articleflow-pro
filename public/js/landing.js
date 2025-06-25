// Landing page specific JavaScript

document.addEventListener('DOMContentLoaded', () => {
  const navToggle = document.getElementById('navToggle');
  const navMenu = document.getElementById('navMenu');

  if (navToggle && navMenu) {
    navToggle.addEventListener('click', () => {
      navMenu.classList.toggle('active');
      navToggle.classList.toggle('active');
    });
  }

  // Animate stats numbers
  const statNumbers = document.querySelectorAll('.stat-number');

  statNumbers.forEach(el => {
    const target = +el.getAttribute('data-target');
    let count = 0;
    const increment = target / 100;

    const updateCount = () => {
      count += increment;
      if (count < target) {
        el.textContent = Math.floor(count);
        requestAnimationFrame(updateCount);
      } else {
        el.textContent = target;
      }
    };

    updateCount();
  });

  // Smooth scroll for Learn More button
  const learnMoreBtn = document.querySelector('.btn-secondary');
  if (learnMoreBtn) {
    learnMoreBtn.addEventListener('click', e => {
      e.preventDefault();
      const featuresSection = document.getElementById('features');
      if (featuresSection) {
        featuresSection.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }

  // Parallax effect for hero section
  window.addEventListener('scroll', () => {
    const scrolled = window.pageYOffset;
    const rate = scrolled * -0.5;
    const heroGraphic = document.querySelector('.hero-graphic');
    if (heroGraphic) {
      heroGraphic.style.transform = `translateY(${rate}px)`;
    }
  });

  // Add fade-in class to elements for animation
  const animateElements = document.querySelectorAll('.feature-card, .tech-item, .detail-card');
  animateElements.forEach(el => {
    el.classList.add('fade-in');
  });

  // Typing effect for hero title
  const heroTitle = document.querySelector('.hero-title');
  if (heroTitle) {
    const text = heroTitle.textContent;
    heroTitle.textContent = '';
    let i = 0;
    
    const typeWriter = () => {
      if (i < text.length) {
        heroTitle.textContent += text.charAt(i);
        i++;
        setTimeout(typeWriter, 50);
      }
    };
    
    setTimeout(typeWriter, 1000);
  }

  // Add hover effects to feature cards
  const featureCards = document.querySelectorAll('.feature-card');
  featureCards.forEach(card => {
    card.addEventListener('mouseenter', () => {
      card.style.transform = 'translateY(-10px) scale(1.02)';
    });
    
    card.addEventListener('mouseleave', () => {
      card.style.transform = 'translateY(0) scale(1)';
    });
  });

  // Navbar background on scroll
  const navbar = document.querySelector('.navbar');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      navbar.style.background = 'rgba(255, 255, 255, 0.98)';
      navbar.style.boxShadow = '0 2px 20px rgba(0,0,0,0.1)';
    } else {
      navbar.style.background = 'rgba(255, 255, 255, 0.95)';
      navbar.style.boxShadow = 'none';
    }
  });
});
