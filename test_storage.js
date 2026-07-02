import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

let url = ''
let key = ''

try {
  // อ่านจาก .env ตรงๆ
  const envFile = fs.readFileSync('.env', 'utf8')
  envFile.split('\n').forEach(line => {
    const parts = line.split('=')
    if (parts.length >= 2) {
      const k = parts[0].trim()
      const v = parts[1].trim().replace(/^['"]|['"]$/g, '') // เอาเครื่องหมายคำพูดออก
      if (k === 'VITE_SUPABASE_URL') url = v
      if (k === 'VITE_SUPABASE_ANON_KEY') key = v
    }
  })
} catch (e) {
  console.error('Cannot read .env file', e)
}

if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env')
  process.exit(1)
}

const supabase = createClient(url, key)

async function testStorage() {
  const { data, error } = await supabase.storage.listBuckets()
  if (error) {
    console.error('Error listing buckets:', error.message)
  } else {
    console.log('--- AVAILABLE BUCKETS ---')
    data.forEach(b => console.log(`- Bucket Name: "${b.name}" (Public: ${b.public})`))
    console.log('-------------------------')
  }
}

testStorage()
