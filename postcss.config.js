module.exports = {
  plugins: {
    '@tailwindcss/postcss': {},
    // Tailwind 4 prefixes only its own output; autoprefixer keeps the -webkit- prefixes the other stylesheets
    // (backdrop-filter, appearance) had on Tailwind 3, which older iPhone Safari needs.
    autoprefixer: {},
  },
}
