import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix Leaflet default icon paths
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const RANK_COLORS = ['#D92332', '#ff6b35', '#f7c59f', '#efefd0', '#4ecdc4']
const RING_COLORS = ['rgba(217,35,50,0.15)', 'rgba(255,107,53,0.10)', 'rgba(100,100,255,0.07)']

function createDonorIcon(rank, color) {
  return L.divIcon({
    className: '',
    html: `
      <div style="
        width: 36px; height: 36px; border-radius: 50%;
        background: ${color}; border: 3px solid white;
        display: flex; align-items: center; justify-content: center;
        font-weight: bold; color: white; font-size: 13px;
        box-shadow: 0 2px 12px rgba(0,0,0,0.5);
        font-family: 'Inter', sans-serif;
      ">${rank}</div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
  })
}

function createPatientIcon() {
  return L.divIcon({
    className: '',
    html: `
      <div style="
        width: 44px; height: 44px; border-radius: 50%;
        background: linear-gradient(135deg,#D92332,#8b0000);
        border: 4px solid white;
        display: flex; align-items: center; justify-content: center;
        font-size: 20px;
        box-shadow: 0 2px 16px rgba(217,35,50,0.8);
      ">🏥</div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -26],
  })
}

export default function DonorMap({ patient, donors, style = {} }) {
  const mapRef = useRef(null)
  const mapInstance = useRef(null)

  useEffect(() => {
    if (!mapRef.current) return

    // Destroy old instance on re-render
    if (mapInstance.current) {
      mapInstance.current.remove()
      mapInstance.current = null
    }

    const centerLat = patient?.latitude || 17.39
    const centerLng = patient?.longitude || 78.46

    const map = L.map(mapRef.current, {
      center: [centerLat, centerLng],
      zoom: 12,
      zoomControl: true,
    })
    mapInstance.current = map

    // Dark tile layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map)

    // Distance rings: 5km, 15km, 30km
    const ringRadii = [5000, 15000, 30000]
    ringRadii.forEach((r, i) => {
      L.circle([centerLat, centerLng], {
        radius: r,
        color: RANK_COLORS[0],
        fillColor: RING_COLORS[i] || 'transparent',
        fillOpacity: 0.1,
        weight: 1,
        dashArray: '6 4',
      }).addTo(map)

      // Ring label
      L.marker(
        [centerLat + r * 0.000009, centerLng],
        {
          icon: L.divIcon({
            className: '',
            html: `<span style="color:rgba(217,35,50,0.7);font-size:11px;font-weight:600;white-space:nowrap">${r / 1000}km</span>`,
            iconSize: [40, 16],
          })
        }
      ).addTo(map)
    })

    // Patient marker
    if (patient) {
      const patientMarker = L.marker([centerLat, centerLng], { icon: createPatientIcon() })
      patientMarker.bindPopup(`
        <div style="font-family:'Inter',sans-serif;min-width:180px">
          <div style="font-weight:700;font-size:14px;color:#D92332">🏥 ${patient.name || 'Patient'}</div>
          <div style="margin-top:4px;font-size:12px;color:#666">${patient.hospital || ''}</div>
          <div style="font-size:12px;color:#666">${patient.blood_group || ''} • ${patient.city || ''}</div>
        </div>
      `)
      patientMarker.addTo(map)
    }

    // Donor markers
    if (donors && donors.length > 0) {
      donors.forEach((donor, idx) => {
        const rank = donor.rank || idx + 1
        const color = RANK_COLORS[Math.min(idx, RANK_COLORS.length - 1)]
        const lat = donor.latitude || (centerLat + (Math.random() - 0.5) * 0.08)
        const lng = donor.longitude || (centerLng + (Math.random() - 0.5) * 0.08)

        const marker = L.marker([lat, lng], { icon: createDonorIcon(rank, color) })
        marker.bindPopup(`
          <div style="font-family:'Inter',sans-serif;min-width:180px">
            <div style="font-weight:700;font-size:13px;color:#D92332">Rank #${rank}: ${donor.donor_name || donor.name}</div>
            <div style="margin-top:4px;font-size:12px;color:#555">
              🩸 ${donor.blood_group || ''}<br/>
              📍 ${donor.distance_km != null ? donor.distance_km.toFixed(1) + ' km away' : ''}<br/>
              ⭐ Score: ${donor.score || 0}<br/>
              📞 Prefers: ${donor.preferred_channel || 'WhatsApp'} (${donor.preferred_language || 'English'})<br/>
              ⏰ Best time: ${donor.preferred_time_period || 'Morning'}
            </div>
          </div>
        `)
        marker.addTo(map)
      })

      // Fit map to all markers
      const allLats = [centerLat, ...donors.map(d => d.latitude || centerLat + (Math.random() - 0.5) * 0.08)]
      const allLngs = [centerLng, ...donors.map(d => d.longitude || centerLng + (Math.random() - 0.5) * 0.08)]
      const bounds = L.latLngBounds(
        allLats.map((lat, i) => [lat, allLngs[i]])
      )
      map.fitBounds(bounds, { padding: [40, 40] })
    }

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove()
        mapInstance.current = null
      }
    }
  }, [patient, donors])

  return (
    <div style={{ position: 'relative', ...style }}>
      <div
        style={{
          position: 'absolute', top: 12, left: 12, zIndex: 1000,
          background: 'rgba(15,15,25,0.85)', backdropFilter: 'blur(8px)',
          borderRadius: 10, padding: '8px 14px', fontSize: 12, color: '#aaa',
          border: '1px solid rgba(217,35,50,0.3)',
        }}
      >
        <span style={{ color: '#D92332', fontWeight: 700 }}>🗺 Donor Radar</span>
        &nbsp;· Rings: 5km / 15km / 30km
      </div>
      <div ref={mapRef} style={{ width: '100%', height: '100%', borderRadius: 'inherit' }} />
    </div>
  )
}
