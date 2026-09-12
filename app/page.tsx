'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Shield, Calendar, Layers3, Loader2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useGallery } from '@/hooks/useGallery'
import { Button } from '@/components/ui/button'
import { GalleryGrid } from '@/components/gallery/GalleryGrid'
import { GalleryItemModal } from '@/components/gallery/GalleryItemModal'
import { LoginModal } from '@/components/auth/LoginModal'
import { GalleryPermissionBanner } from '@/components/auth/GalleryPermissionBanner'
import { VaultTopBar } from '@/components/layout/VaultTopBar'
import { Sidebar } from '@/components/layout/Sidebar'
import { UploadSheet } from '@/components/upload/UploadSheet'
import { UploadProgress } from '@/components/upload/UploadProgress'
import { SettingsDrawer } from '@/components/settings/SettingsDrawer'
import type { BackupRecord, GalleryMediaFilter, GallerySortOrder } from '@/types'

function ToggleButton({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? 'secondary' : 'outline'}
      onClick={onClick}
      className={`rounded-full px-4 text-xs ${
        active 
          ? 'bg-[#222222] text-foreground border-transparent' 
          : 'border-[#1A1A1A] hover:bg-[#111111] hover:text-foreground text-muted-foreground'
      }`}
    >
      {children}
    </Button>
  )
}

export default function RootPage() {
  const { ready, authenticated } = useAuth()
  
  // Modal & sheet states
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [showUploadSheet, setShowUploadSheet] = useState(false)
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false)
  
  // Gallery query parameters
  const [sortOrder, setSortOrder] = useState<GallerySortOrder>('newest')
  const [mediaFilter, setMediaFilter] = useState<GalleryMediaFilter>('all')
  const [selectedBackup, setSelectedBackup] = useState<BackupRecord | null>(null)

  const galleryQuery = useGallery({
    pageSize: 40,
    sortOrder,
    mediaFilter,
  })

  // Summary counts for filter pill display
  const mediaSummary = useMemo(() => {
    const photos = galleryQuery.backups.filter((b) => b.mimeType?.startsWith('image/')).length
    const videos = galleryQuery.backups.filter((b) => b.mimeType?.startsWith('video/')).length
    return { photos, videos }
  }, [galleryQuery.backups])

  // Simple loading splash before Privy initializes
  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0A0A0A] px-4">
        <div className="flex flex-col items-center gap-4 text-center">
          <Shield className="h-10 w-10 text-primary animate-pulse" />
          <p className="text-xs text-muted-foreground tracking-widest font-mono">INITIALIZING SECURE VAULT...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-foreground font-sans selection:bg-primary/20">
      
      {/* Dynamic Content Transitions with AnimatePresence */}
      <AnimatePresence mode="wait">
        {!authenticated ? (
          
          /* SCREEN 1: LANDING SCREEN */
          <motion.main
            key="landing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="flex min-h-screen flex-col items-center justify-center px-4 py-16 relative overflow-hidden"
          >
            {/* Center Lock and Branding */}
            <div className="flex flex-col items-center text-center space-y-6 max-w-md z-10">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[#222222] bg-[#111111] shadow-2xl text-primary animate-in zoom-in-95 duration-500">
                <Shield className="h-8 w-8" />
              </div>
              <div className="space-y-2">
                <h1 className="text-4xl font-black tracking-widest text-foreground font-mono">VAULTLY</h1>
                <p className="text-sm text-muted-foreground uppercase tracking-widest">
                  Your memories, encrypted.
                </p>
              </div>
              
              {/* Primary Call to Action */}
              <Button
                onClick={() => setShowLoginModal(true)}
                className="h-12 w-full sm:w-[280px] bg-primary text-primary-foreground hover:bg-primary/95 text-sm font-semibold tracking-wider transition-all shadow-lg shadow-primary/10 rounded-xl"
              >
                Open My Vault
              </Button>

              <p className="text-[10.5px] text-muted-foreground/75 leading-relaxed">
                No account needed to browse. Login only to access your backups.
              </p>
            </div>

            {/* Ambient visual decorations */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />

            {/* Subtle Photo Directory Permission Banner */}
            <GalleryPermissionBanner />
          </motion.main>

        ) : (

          /* SCREEN 3: VAULT / GALLERY */
          <motion.div
            key="gallery"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="pl-60 pt-16 min-h-screen bg-[#0A0A0A]"
          >
            <Sidebar />
            <div className="px-6 py-6 space-y-6">
            {/* Top Bar Navigation */}
            <VaultTopBar 
              onUploadClick={() => setShowUploadSheet(true)}
              onSettingsClick={() => setShowSettingsDrawer(true)}
            />

            {/* Search Sorting and Filtering Controls */}
            <section className="flex flex-wrap items-center gap-4 rounded-2xl border border-[#1A1A1A] bg-[#111111]/40 backdrop-blur-md p-4 animate-in fade-in-50 duration-300">
              <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono uppercase tracking-wider">
                <Calendar className="h-4 w-4 text-primary" />
                Sort
              </div>
              <ToggleButton active={sortOrder === 'newest'} onClick={() => setSortOrder('newest')}>
                Newest
              </ToggleButton>
              <ToggleButton active={sortOrder === 'oldest'} onClick={() => setSortOrder('oldest')}>
                Oldest
              </ToggleButton>

              <div className="mx-2 hidden h-6 w-px bg-[#1A1A1A] md:block" />

              <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono uppercase tracking-wider">
                <Layers3 className="h-4 w-4 text-primary" />
                Filter
              </div>
              <ToggleButton active={mediaFilter === 'all'} onClick={() => setMediaFilter('all')}>
                All
              </ToggleButton>
              <ToggleButton active={mediaFilter === 'photos'} onClick={() => setMediaFilter('photos')}>
                Photos {mediaSummary.photos > 0 ? `(${mediaSummary.photos})` : ''}
              </ToggleButton>
              <ToggleButton active={mediaFilter === 'videos'} onClick={() => setMediaFilter('videos')}>
                Videos {mediaSummary.videos > 0 ? `(${mediaSummary.videos})` : ''}
              </ToggleButton>
            </section>

            {/* Error feedback */}
            {galleryQuery.error && (
              <div className="p-4 border border-destructive/20 bg-destructive/5 text-destructive rounded-xl text-sm flex items-center justify-between">
                <span>Failed to fetch backups: {galleryQuery.error.message}</span>
                <Button size="sm" variant="outline" className="border-destructive/20 hover:bg-destructive/10" onClick={() => void galleryQuery.refetch()}>
                  Retry
                </Button>
              </div>
            )}

            {/* Gallery Media Grid */}
            <GalleryGrid
              backups={galleryQuery.backups}
              isLoading={galleryQuery.isLoading}
              hasNextPage={galleryQuery.hasNextPage ?? false}
              isFetchingNextPage={galleryQuery.isFetchingNextPage}
              onSelectBackup={(backup) => setSelectedBackup(backup)}
              onUploadClick={() => setShowUploadSheet(true)}
              onLoadMore={() => {
                void galleryQuery.fetchNextPage()
              }}
              onRefresh={() => {
                void galleryQuery.refetch()
              }}
            />

            {/* Loader indicator for paginated content fetch */}
            {galleryQuery.isFetchingNextPage && (
              <div className="flex items-center justify-center gap-2.5 py-6 text-xs text-muted-foreground font-mono">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                LOADING NEXT ENCRYPTED MEDIA BATCH...
              </div>
            )}
            </div>
          </motion.div>

        )}
      </AnimatePresence>

      {/* Persistent global Modals and Bottom Sheets */}
      <AnimatePresence>
        {showLoginModal && (
          <LoginModal 
            isOpen={showLoginModal} 
            onClose={() => setShowLoginModal(false)} 
          />
        )}
      </AnimatePresence>

      <UploadSheet
        isOpen={showUploadSheet}
        onClose={() => setShowUploadSheet(false)}
        onComplete={() => {
          void galleryQuery.refetch()
        }}
      />

      <SettingsDrawer
        isOpen={showSettingsDrawer}
        onClose={() => setShowSettingsDrawer(false)}
      />

      <UploadProgress />

      {/* Selected media detail preview modal */}
      {selectedBackup && (
        <GalleryItemModal
          backup={selectedBackup}
          open={Boolean(selectedBackup)}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedBackup(null)
            }
          }}
          onDeleted={() => {
            setSelectedBackup(null)
            void galleryQuery.refetch()
          }}
        />
      )}
    </div>
  )
}
