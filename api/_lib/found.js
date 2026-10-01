import { admin } from './supabase.js';
import { burnCode } from './codes.js';
import { notifyAdmin } from './email.js';

/**
 * Un utente (già membro) riscatta il codice della busta di un quadro:
 * il codice si brucia e nasce una richiesta di ritrovamento "in attesa" (la approva Lorenzo dallo Studio).
 * L'accesso al Circolo si apre solo all'approvazione.
 */
export async function claimArtworkCode(userId, nickname, codeRow) {
  const burned = await burnCode(codeRow.id, userId);
  if (!burned) throw Object.assign(new Error('Codice già utilizzato.'), { status: 409 });

  const { data: request, error } = await admin
    .from('wm_found_requests')
    .insert({ user_id: userId, code_id: codeRow.id, piece_id: codeRow.piece_id })
    .select()
    .single();
  if (error) throw error;

  let pieceTitle = 'un Whiskey';
  if (codeRow.piece_id) {
    const { data: piece } = await admin.from('wm_pieces').select('title').eq('id', codeRow.piece_id).maybeSingle();
    if (piece?.title) pieceTitle = piece.title;
  }
  await notifyAdmin(`found:${request.id}`, 'Nuovo ritrovamento da approvare', [
    `${nickname} ha inserito il codice di ${pieceTitle}.`,
    'Appena carica la foto potrai approvare la richiesta dallo Studio.',
  ]);
  return request;
}
