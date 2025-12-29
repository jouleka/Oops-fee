/**
 * Landing Page Footer
 * Clean, minimal with links
 */

export function Footer() {
  const currentYear = new Date().getFullYear();

  const handleLinkClick = (link: string) => {
    // For now, these could link to actual pages or modals
    console.log(`Navigate to: ${link}`);
  };

  return (
    <footer className="relative border-t border-neutral-800 bg-abyss-900">
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Top section with logo and links */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-8 mb-8">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <span className="font-display text-2xl font-bold text-white tracking-tight">
              OopsFee
            </span>
            <span className="text-xs text-neutral-600 font-mono uppercase tracking-wider">
              v1.0
            </span>
          </div>

          {/* Navigation links */}
          <nav className="flex flex-wrap items-center justify-center gap-8">
            <button
              onClick={() => handleLinkClick('privacy')}
              className="text-neutral-400 hover:text-white text-sm transition-colors duration-200"
            >
              Privacy Policy
            </button>
            <button
              onClick={() => handleLinkClick('terms')}
              className="text-neutral-400 hover:text-white text-sm transition-colors duration-200"
            >
              Terms of Service
            </button>
            <button
              onClick={() => handleLinkClick('support')}
              className="text-neutral-400 hover:text-white text-sm transition-colors duration-200"
            >
              Support
            </button>
            <a
              href="https://twitter.com/oopsfee"
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-400 hover:text-white text-sm transition-colors duration-200 flex items-center gap-2"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              X / Twitter
            </a>
          </nav>
        </div>

        {/* Divider */}
        <div className="w-full h-px bg-neutral-800 mb-8" />

        {/* Bottom section */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-neutral-600">
          <p>
            © {currentYear} OopsFee. All rights reserved.
          </p>
          
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-lime-400/50" />
              Made for people who are tired of their own excuses
            </span>
          </div>
        </div>
      </div>

      {/* Decorative gradient line at bottom */}
      <div 
        className="h-1 w-full"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, #BFFF00 20%, #007AFF 50%, #FF3B30 80%, transparent 100%)',
          opacity: 0.5,
        }}
      />
    </footer>
  );
}

