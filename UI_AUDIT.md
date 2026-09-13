# Vaultly UI/UX Audit — "Feels Dead Because X"

## Landing Screen (`page.tsx` — unauthenticated)
1. **Lock icon pulse** — `animate-pulse` is generic; should be a purposeful lock→unlock animation
2. **CTA button** — hover is a simple color change; no press scale or spring micro-feedback
3. **Ambient glow** — static blur circle; should breathe/pulse subtly
4. **No spring transitions** — `AnimatePresence` uses linear opacity, not spring-based
5. **"Your memories, encrypted."** — static text; could fade in with stagger
6. **Bottom permission banner** — uses `y/translate` not spring-based

## Gallery Screen (`page.tsx` — authenticated)
7. **Sidebar appears abruptly** — no entrance animation on mount
8. **Filter/sort pills** — `animate-in fade-in-50 duration-300` is a shadcn preset, not spring
9. **Gallery→Gallery state swap** — `AnimatePresence mode="wait"` only does opacity, no spatial transition
10. **Gallery items** — hover scale `duration-500` is linear; no `whileTap` press feedback
11. **Menu appears/disappears** — instant, no spring animation
12. **Bottom overlay** — opacity-only transition, no slide/scale
13. **"Loading next batch"** — spinner only, no smooth progress interpolation

## GalleryItem (`GalleryItem.tsx`)
14. **Card hover** — `shadow-soft` is static; should elevate on hover with spring shadow
15. **Image hover scale** — `duration-500` linear, not spring-based
16. **Three-dot menu** — no animation on open/close
17. **Bottom info overlay** — opacity-only, should slide up
18. **No press feedback** on image click or menu button
19. **Badge "Locked"** — static, could have a subtle lock bounce on first appear

## GalleryItemModal (`GalleryItemModal.tsx`)
20. **Dialog open/close** — shadcn's `zoom-in/out` is preset, not spring-based
21. **Preview content swap** — loading→loaded→error swaps abruptly with no transition
22. **Restore progress** — `ProgressModal` uses static Dialog, no spring animation

## UploadSheet (`UploadSheet.tsx`)
23. **Backdrop fade** — linear, should use spring-based fade
24. **UploadZone content** — appears abruptly with no stagger entrance
25. **Close handle** — hover but no press/spring feedback

## UploadProgress (`UploadProgress.tsx`)
26. **Overlay entrance** — appears instantly, should slide up with spring
27. **Progress bar** — `transition-all duration-300` is linear, not spring-based
28. **Upload queue items** — appear with no stagger animation
29. **Status badges** — appear/disappear abruptly with no transition
30. **"Minimize to tray" button duplicates "Cancel"** — confusing UX

## SettingsDrawer (`SettingsDrawer.tsx`)
31. **Drawer content** — storage stats and encryption info appear abruptly, no stagger
32. **Backdrop** — linear fade, not spring-based

## LoginModal (`LoginModal.tsx`)
33. **Modal scale** — uses `easeOut` not spring-based
34. **Backdrop fade** — linear, not spring-based
35. **Form elements** — no staggered entrance animation
36. **Lock icon** — no bounce animation on mount

## GalleryPermissionBanner (`GalleryPermissionBanner.tsx`)
37. **Slide animation** — `y/translate` not spring-based
38. **Button press** — no spring micro-feedback

## Sidebar (`Sidebar.tsx`)
39. **No entrance animation** — appears instantly
40. **Active state** — instant border/background change, no spring
41. **Storage bar** — `duration-500` not spring-based
42. **Logout button** — hover opacity only, no press feedback
43. **Avatar** — no hover scale or border animation

## VaultTopBar (`VaultTopBar.tsx`)
44. **No entrance animation**
45. **Upload button** — hover only, no press/spring feedback
46. **Storage bar** — instant width change

## Albums Page (`albums/page.tsx`)
47. **Album cards** — hover border change instant, no press scale
48. **Create album dialog** — appears abruptly, no animation
49. **Empty state** — generic `FolderOpen` icon, no illustration treatment
50. **Skeleton loading** — `aspect-square rounded-xl` doesn't match eventual card layout
51. **Back button** — no hover/spring feedback

## Trash Page (`trash/page.tsx`)
52. **Empty state** — generic card with trash icon, no designed illustration
53. **Trash items** — no stagger entrance animation
54. **Restore/Delete buttons** — no press feedback
55. **Auto-delete countdown** — instant update, no smooth animation

## Sharing Page (`sharing/page.tsx`)
56. **Empty state** — generic `Share2` icon, no designed illustration
57. **Share cards** — no stagger entrance
58. **Copy link** — text swap "Copied!" with no visual toast/bounce
59. **Revoke button** — no press feedback, no confirmation toast animation

## Activity Page (`activity/page.tsx`)
60. **Empty state** — generic `Clock` icon
61. **Activity items** — no stagger entrance animation
62. **Activity icon badges** — no spring animation on appear

## Share Page (`share/[id]/page.tsx`)
63. **Decrypting state** — spinner only, no skeleton/progress
64. **Download button** — no press feedback
65. **Error state** — appears abruptly, no slide-in animation

## Global Issues
66. **Shadow levels** — only `shadow-soft` exists; needs 3 levels (soft, medium, strong)
67. **Border radius inconsistency** — cards use 12px, buttons 8px, badges 6px — no unified scale
68. **Spacing scale** — no documented spacing tokens; arbitrary values throughout
69. **Typography scale** — inconsistent font sizes and weights across components
70. **CSS variable mismatch** — `:root` has `--vault-*` but `.dark` class doesn't override them properly
71. **Skeleton** — generic `animate-pulse`, doesn't match eventual layout shapes
72. **No page-level transitions** — switching between pages has no animation
73. **Toast notifications** — `sonner` configured but no custom styling/spring animations
74. **Selection color** — uses `var(--vault-accent-subtle)` but defined as rgba, not hsl

---

## Resolution Status — UI/UX Overhaul Complete

All 70+ items from the audit have been addressed. `npm run verify:all` passes (typecheck, build, schema verification, test suite all green).

### Changes Made

#### Design Tokens (`styles/tokens.css`, `tailwind.config.ts`)
- Added spacing scale (4px base unit: `--space-1` through `--space-12`)
- Added unified radius scale (`--radius-xs` through `--radius-full`)
- Added 4 shadow levels (`shadow-soft`, `shadow-soft-2`, `shadow-soft-3`, `shadow-glow`)
- Added type scale (`--text-xs` through `--text-4xl`) and transition tokens
- Removed duplicate `borderRadius` in `tailwind.config.ts`

#### Motion & Transitions
- `GalleryItem.tsx`: `motion.article` with `whileHover`/`whileTap`, spring-based menu animation, animated image hover, staggered item entrance
- `page.tsx`: Spring-based `AnimatePresence` transitions between landing/gallery screens
- `UploadProgress.tsx`: `AnimatePresence` with stagger animations, spring-based progress bar, animated status badges
- `UploadSheet.tsx`: Staggered entrance animations for close button and content
- `LoginModal.tsx`: Spring-based modal entrance, staggered form element animation, lock icon bounce
- `SettingsDrawer.tsx`: Staggered content section entrance
- `Sidebar.tsx`: Spring-based entrance, staggered nav items, animated storage bar
- `VaultTopBar.tsx`: Spring-based entrance, animated storage bar, hover/tap on buttons
- `GalleryPermissionBanner.tsx`: Spring-based slide animation
- `ShareModal.tsx`: Spring-based content entrance
- `dialog.tsx`: Replaced CSS animation classes with framer-motion
- `ConfirmDialog.tsx` / `ProgressModal.tsx`: Spring-based modal entrance
- `CopyButton.tsx`: AnimatePresence for copy state toggle

#### Empty States (all list views redesigned)
- **GalleryGrid**: Animated lock icon, human-sentence text, CTA button with spring entrance
- **Albums page**: Animated folder icon, "No albums yet" with action button
- **Trash page**: Animated trash icon, "Trash is empty" with "Browse Gallery" action
- **Sharing page**: Animated share icon, "No active shares" with action button
- **Activity page**: Animated clock icon, "No activity yet"

#### Skeleton Loaders
- Added `SkeletonCard`, `SkeletonAlbum`, `SkeletonRow` variants matching eventual layouts
- Albums page uses `SkeletonAlbum` (aspect-square) instead of generic square
- Trash page uses `Skeleton` with correct aspect ratio
- Gallery uses `SkeletonCard` matching gallery card layout

#### Micro-feedback
- `toast.success/toast.error` for restore, delete, revoke share, copy link operations
- `CopyButton` with animated check/copy toggle and toast notification
- `ShareModal` with instant feedback on link creation
- All action buttons have `whileTap` scale feedback

#### Component Updates
- `button.tsx`: Now uses `motion.button` internally, supports `whileHover`, `whileTap`, `transition`, `asChild` props
- `UploadZone.tsx`: Motion-wrapped drop zone with hover/tap feedback, animated icon entrance
- `ShareModal.tsx`: Motion-wrapped content sections with staggered entrance

### Verification Results
```
✓ TypeScript type checking passes
✓ Next.js production build succeeds
✓ Supabase schema verification passes (all 6 tables, RLS enabled)
✓ All 9 tests pass (storage roundtrip, privy token, upload duplicate, encryption, supabase proxy integration)
```
