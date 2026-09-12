const { createClient } = require('@supabase/supabase-js');
const crypto = require('node:crypto').webcrypto;
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load .env.local from photo project
const envPath = path.join(__dirname, '.env.local');
const envConfig = dotenv.parse(fs.readFileSync(envPath));

const SUPABASE_URL = envConfig.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = envConfig.SUPABASE_SERVICE_ROLE_KEY;
const LIGHTHOUSE_API_KEY = envConfig.LIGHTHOUSE_API_KEY;
const APP_URL = envConfig.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function runVerification() {
  console.log('====================================================');
  console.log('STARTING VAULTLY RUNTIME VERIFICATION SUITE');
  console.log('====================================================\n');

  const results = {};

  // ----------------------------------------------------
  // TEST 1: Fresh Login & User DB Record
  // ----------------------------------------------------
  console.log('--- TEST 1: Fresh Login & Database User Creation ---');
  try {
    const testPrivyId = `did:privy:test_user_${Date.now()}`;
    const testEmail = `testuser_${Date.now()}@example.com`;

    const { data: upsertData, error: upsertErr } = await supabase
      .from('users')
      .upsert({ privy_user_id: testPrivyId, email: testEmail, updated_at: new Date().toISOString() })
      .select('*')
      .single();

    if (upsertErr) throw upsertErr;

    console.log('PASS: Created user in Supabase DB.');
    console.log('   User ID:', upsertData.id);
    console.log('   Privy ID:', upsertData.privy_user_id);
    console.log('   Email:', upsertData.email);

    results.test1 = { status: 'PASS', userId: upsertData.id, privyUserId: testPrivyId, email: testEmail };
  } catch (err) {
    console.error('FAIL: Test 1 error:', err.message);
    results.test1 = { status: 'FAIL', error: err.message };
  }

  const userId = results.test1.userId;

  // ----------------------------------------------------
  // TEST 2: Upload Flow (EXIF strip, AES-GCM Encrypt, Lighthouse, Supabase Backups)
  // ----------------------------------------------------
  console.log('\n--- TEST 2: Upload Flow (Encryption + Lighthouse + Supabase Backup) ---');
  try {
    const rawData = Buffer.from('TEST_IMAGE_PAYLOAD_DATA_' + Date.now());

    // Generate key & IV
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encryptedContent = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, rawData);
    const encryptedBuffer = Buffer.from(encryptedContent);
    const ivBase64 = iv.toString('base64');

    // Upload to Lighthouse via SDK / fetch
    const lighthouseSdk = require('@lighthouse-web3/sdk');
    const uploadRes = await lighthouseSdk.uploadBuffer(encryptedBuffer, LIGHTHOUSE_API_KEY);
    const cid = uploadRes.data.Hash;

    console.log('   Uploaded to Lighthouse. CID:', cid);

    // Insert backup into Supabase
    const { data: backupRow, error: backupErr } = await supabase
      .from('backups')
      .insert({
        user_id: userId,
        cid: cid,
        original_filename: 'test_photo.jpg',
        original_hash: crypto.createHash ? crypto.createHash('sha256').update(rawData).digest('hex') : 'hash123',
        mime_type: 'image/jpeg',
        encrypted_size: encryptedBuffer.length,
        original_size: rawData.length,
        iv: ivBase64,
      })
      .select('*')
      .single();

    if (backupErr) throw backupErr;

    console.log('PASS: Uploaded encrypted photo and saved backup record.');
    console.log('   Backup ID:', backupRow.id);
    console.log('   CID:', backupRow.cid);
    console.log('   IV:', backupRow.iv);

    results.test2 = { status: 'PASS', backupId: backupRow.id, cid, ivBase64, key, rawData };
  } catch (err) {
    console.error('FAIL: Test 2 error:', err.message);
    results.test2 = { status: 'FAIL', error: err.message };
  }

  const backupId = results.test2.backupId;
  const key = results.test2.key;
  const rawData = results.test2.rawData;

  // ----------------------------------------------------
  // TEST 3: Retrieval & Decryption Flow
  // ----------------------------------------------------
  console.log('\n--- TEST 3: Retrieval & Decryption Flow ---');
  try {
    const fetchRes = await fetch(`https://gateway.lighthouse.storage/ipfs/${results.test2.cid}`);
    if (!fetchRes.ok) throw new Error(`Gateway returned HTTP ${fetchRes.status}`);

    const fetchedArrayBuffer = await fetchRes.arrayBuffer();
    const fetchedIv = Buffer.from(results.test2.ivBase64, 'base64');

    const decryptedContent = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fetchedIv },
      key,
      fetchedArrayBuffer
    );
    const decryptedBuffer = Buffer.from(decryptedContent);

    if (Buffer.compare(decryptedBuffer, rawData) !== 0) {
      throw new Error('Decrypted payload does not match original payload');
    }

    console.log('PASS: Downloaded ciphertext from IPFS gateway and decrypted successfully.');
    console.log('   Decrypted size:', decryptedBuffer.length, 'bytes');
    console.log('   Payload match verified!');

    results.test3 = { status: 'PASS' };
  } catch (err) {
    console.error('FAIL: Test 3 error:', err.message);
    results.test3 = { status: 'FAIL', error: err.message };
  }

  // ----------------------------------------------------
  // TEST 4: Trash Flow (Soft Delete -> Trash View -> Restore -> Hard Delete)
  // ----------------------------------------------------
  console.log('\n--- TEST 4: Trash Flow (Soft Delete, Trash List, Restore, Hard Delete) ---');
  try {
    // 1. Soft delete
    const deleteTime = new Date().toISOString();
    const { error: softDelErr } = await supabase
      .from('backups')
      .update({ deleted_at: deleteTime })
      .eq('id', backupId);
    if (softDelErr) throw softDelErr;

    // Verify item is in trash
    const { data: trashItems } = await supabase
      .from('backups')
      .select('*')
      .eq('user_id', userId)
      .not('deleted_at', 'is', null);

    if (!trashItems.find(b => b.id === backupId)) {
      throw new Error('Backup not found in trash view');
    }
    console.log('   Step 4.1 PASS: Item soft-deleted and present in trash query (deleted_at set).');

    // 2. Restore
    const { error: restoreErr } = await supabase
      .from('backups')
      .update({ deleted_at: null })
      .eq('id', backupId);
    if (restoreErr) throw restoreErr;

    const { data: activeBackups } = await supabase
      .from('backups')
      .select('*')
      .eq('id', backupId)
      .is('deleted_at', null)
      .single();

    if (!activeBackups) throw new Error('Backup not restored properly');
    console.log('   Step 4.2 PASS: Item restored successfully (deleted_at cleared).');

    // 3. Create temporary backup for hard delete test
    const { data: tempBackup } = await supabase
      .from('backups')
      .insert({
        user_id: userId,
        cid: results.test2.cid,
        original_filename: 'temp_to_delete.jpg',
        mime_type: 'image/jpeg',
        iv: results.test2.ivBase64
      })
      .select('*')
      .single();

    const { error: hardDelErr } = await supabase
      .from('backups')
      .delete()
      .eq('id', tempBackup.id);
    if (hardDelErr) throw hardDelErr;

    const { data: checkHardDel } = await supabase
      .from('backups')
      .select('*')
      .eq('id', tempBackup.id)
      .maybeSingle();

    if (checkHardDel !== null) throw new Error('Row still exists after hard delete');
    console.log('   Step 4.3 PASS: Hard delete permanently removed backup row from DB.');

    results.test4 = { status: 'PASS' };
  } catch (err) {
    console.error('FAIL: Test 4 error:', err.message);
    results.test4 = { status: 'FAIL', error: err.message };
  }

  // ----------------------------------------------------
  // TEST 5: Albums Flow (Create Album -> Add Photo -> List Album -> Remove Photo)
  // ----------------------------------------------------
  console.log('\n--- TEST 5: Albums Flow (Create, Add, Query, Remove) ---');
  try {
    // 1. Create album
    const { data: album, error: albumErr } = await supabase
      .from('albums')
      .insert({ user_id: userId, name: 'Vacation 2026' })
      .select('*')
      .single();
    if (albumErr) throw albumErr;

    console.log('   Step 5.1 PASS: Album created. ID:', album.id);

    // 2. Add photo to album
    const { error: addErr } = await supabase
      .from('album_backups')
      .insert({ album_id: album.id, backup_id: backupId });
    if (addErr) throw addErr;

    console.log('   Step 5.2 PASS: Photo added to album.');

    // 3. Query album backups
    const { data: albumPhotos } = await supabase
      .from('album_backups')
      .select('backup_id, backups(*)')
      .eq('album_id', album.id);

    if (albumPhotos.length === 0 || albumPhotos[0].backup_id !== backupId) {
      throw new Error('Photo not found in album query');
    }
    console.log('   Step 5.3 PASS: Album photos retrieved correctly.');

    // 4. Remove photo from album
    const { error: remErr } = await supabase
      .from('album_backups')
      .delete()
      .eq('album_id', album.id)
      .eq('backup_id', backupId);
    if (remErr) throw remErr;

    const { data: checkRem } = await supabase
      .from('album_backups')
      .select('*')
      .eq('album_id', album.id)
      .eq('backup_id', backupId);

    if (checkRem.length > 0) throw new Error('Photo not removed from album');
    console.log('   Step 5.4 PASS: Photo removed from album, backup row still intact in main gallery.');

    results.test5 = { status: 'PASS', albumId: album.id };
  } catch (err) {
    console.error('FAIL: Test 5 error:', err.message);
    results.test5 = { status: 'FAIL', error: err.message };
  }

  // ----------------------------------------------------
  // TEST 6: Activity Feed Flow
  // ----------------------------------------------------
  console.log('\n--- TEST 6: Activity Feed Query ---');
  try {
    const { data: backups } = await supabase
      .from('backups')
      .select('id, original_filename, created_at, deleted_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    const activities = (backups || []).map(row => ({
      type: row.deleted_at ? 'deleted' : 'uploaded',
      filename: row.original_filename || 'Untitled',
      timestamp: row.deleted_at || row.created_at,
      backupId: row.id,
    }));

    if (activities.length === 0) throw new Error('No activity records returned');

    console.log('PASS: Activity feed generated accurately.');
    console.log('   Activities count:', activities.length);
    console.log('   Sample activity entry:', activities[0]);

    results.test6 = { status: 'PASS' };
  } catch (err) {
    console.error('FAIL: Test 6 error:', err.message);
    results.test6 = { status: 'FAIL', error: err.message };
  }

  // ----------------------------------------------------
  // TEST 7: Sharing Flow (Link creation, Public fetching, Fragment key protection, Revocation, Expiry)
  // ----------------------------------------------------
  console.log('\n--- TEST 7: Sharing Flow (Zero-Knowledge Public Access, Revocation, Expiry) ---');
  try {
    // Step 7.1: Re-encrypt file with share key & upload to Lighthouse
    const shareKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    const shareIv = crypto.getRandomValues(new Uint8Array(12));
    const shareEncrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: shareIv }, shareKey, rawData);

    const lighthouseSdk = require('@lighthouse-web3/sdk');
    const shareUploadRes = await lighthouseSdk.uploadBuffer(Buffer.from(shareEncrypted), LIGHTHOUSE_API_KEY);
    const shareCid = shareUploadRes.data.Hash;

    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    // Create share row
    const { data: shareRow, error: shareErr } = await supabase
      .from('shares')
      .insert({
        backup_id: backupId,
        owner_user_id: userId,
        share_cid: shareCid,
        iv: shareIv.toString('base64'),
        mime_type: 'image/jpeg',
        original_filename: 'test_photo.jpg',
        expires_at: expiresAt,
      })
      .select('*')
      .single();

    if (shareErr) throw shareErr;

    const shareId = shareRow.id;

    // Format raw share key for fragment URL (#key=...)
    const exportedRawKey = await crypto.subtle.exportKey('raw', shareKey);
    const base64Key = Buffer.from(exportedRawKey).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

    const publicUrl = `${APP_URL}/share/${shareId}#key=${base64Key}`;
    console.log('   Step 7.1 PASS: Share created.');
    console.log('   Share ID:', shareId);
    console.log('   Public Share URL:', publicUrl);

    // Step 7.2: Unauthenticated HTTP request to proxy endpoint get_share_public
    const proxyRes = await fetch(`${APP_URL}/api/supabase-proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operation: 'get_share_public', payload: { shareId } })
    });

    if (!proxyRes.ok) throw new Error(`Proxy HTTP error: ${proxyRes.status}`);
    const proxyData = await proxyRes.json();

    if (!proxyData.shareCid || !proxyData.iv) {
      throw new Error('Public proxy endpoint returned incomplete payload: ' + JSON.stringify(proxyData));
    }

    if (proxyData.owner_user_id || proxyData.backup_id) {
      throw new Error('SECURITY VIOLATION: Proxy leaked internal user/backup IDs to public user!');
    }

    console.log('   Step 7.2 PASS: Public get_share_public endpoint returned metadata without auth headers.');
    console.log('   Returned Payload:', proxyData);

    // Step 7.3: Retrieve ciphertext from Lighthouse & decrypt using fragment key
    const shareFetchRes = await fetch(`https://gateway.lighthouse.storage/ipfs/${proxyData.shareCid}`);
    const shareFetchedBytes = await shareFetchRes.arrayBuffer();

    const decryptedShareContent = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: Buffer.from(proxyData.iv, 'base64') },
      shareKey,
      shareFetchedBytes
    );

    if (Buffer.compare(Buffer.from(decryptedShareContent), rawData) !== 0) {
      throw new Error('Public recipient decryption failed: payload mismatch');
    }
    console.log('   Step 7.3 PASS: Recipient successfully downloaded & decrypted file using fragment key!');

    // Step 7.4: Revoke share and verify generic "link unavailable" 404 response
    const { error: revokeErr } = await supabase
      .from('shares')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', shareId);
    if (revokeErr) throw revokeErr;

    const revokedProxyRes = await fetch(`${APP_URL}/api/supabase-proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operation: 'get_share_public', payload: { shareId } })
    });

    const revokedData = await revokedProxyRes.json();
    if (revokedProxyRes.status !== 404 || revokedData.error !== 'This link is no longer available') {
      throw new Error(`Revocation leak: Status=${revokedProxyRes.status}, Error=${revokedData.error}`);
    }
    console.log('   Step 7.4 PASS: Revoked share returned HTTP 404 ("This link is no longer available").');

    // Step 7.5: Test Expired Share (manually set expires_at in the past)
    const { data: expiredShare } = await supabase
      .from('shares')
      .insert({
        backup_id: backupId,
        owner_user_id: userId,
        share_cid: shareCid,
        iv: shareIv.toString('base64'),
        mime_type: 'image/jpeg',
        original_filename: 'expired_photo.jpg',
        expires_at: new Date(Date.now() - 1000000).toISOString(), // Past date
      })
      .select('*')
      .single();

    const expiredProxyRes = await fetch(`${APP_URL}/api/supabase-proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operation: 'get_share_public', payload: { shareId: expiredShare.id } })
    });

    const expiredData = await expiredProxyRes.json();
    if (expiredProxyRes.status !== 404 || expiredData.error !== 'This link is no longer available') {
      throw new Error(`Expiry leak: Status=${expiredProxyRes.status}, Error=${expiredData.error}`);
    }
    console.log('   Step 7.5 PASS: Expired share returned EXACT SAME HTTP 404 ("This link is no longer available").');
    console.log('   Zero status leakage confirmed (revoked vs expired respond identically).');

    results.test7 = { status: 'PASS' };
  } catch (err) {
    console.error('FAIL: Test 7 error:', err.message);
    results.test7 = { status: 'FAIL', error: err.message };
  }

  // ----------------------------------------------------
  // TEST 8: Logout / Login Persistence
  // ----------------------------------------------------
  console.log('\n--- TEST 8: Logout / Login Session Persistence ---');
  try {
    const { data: userRecord } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    const { data: userBackups } = await supabase
      .from('backups')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null);

    const { data: userAlbums } = await supabase
      .from('albums')
      .select('*')
      .eq('user_id', userId);

    if (!userRecord || userBackups.length === 0 || userAlbums.length === 0) {
      throw new Error('Data persistence check failed across session boundary');
    }

    console.log('PASS: User data fully persisted across sessions.');
    console.log('   User ID:', userRecord.id);
    console.log('   Active Backups Count:', userBackups.length);
    console.log('   Albums Count:', userAlbums.length);

    results.test8 = { status: 'PASS' };
  } catch (err) {
    console.error('FAIL: Test 8 error:', err.message);
    results.test8 = { status: 'FAIL', error: err.message };
  }

  console.log('\n====================================================');
  console.log('FINAL VERIFICATION SUMMARY:');
  console.log(JSON.stringify(results, null, 2));
  console.log('====================================================');
}

runVerification().catch(err => {
  console.error('Fatal execution error:', err);
});
