import 'dotenv/config'
import { prisma } from './src/config/prisma'
;(async () => {
  console.log(await prisma.episode.findUnique({ where: { id: '671621ec-fe4a-4336-a25c-e9b08d269955' }, select: { accessType: true, coinPrice: true, episodeNumber: true, series: { select: { lockFromEpisode: true, status: true } } } }))
  await prisma.$disconnect()
})()
