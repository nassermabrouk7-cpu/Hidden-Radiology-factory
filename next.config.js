const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'okijdtchqrihwsyqhyss.supabase.co',
        pathname: '/storage/v1/object/public/**'
      }
    ]
  }
}
module.exports = nextConfig
