'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';

interface OrderItem {
  id: string;
  product: string;
  amount: number;
  created_at: string;
  character_name?: string;
}

function getProductLabel(product: string): string {
  if (product === 'plus') return 'MatchUp+';
  if (product === 'pro') return 'MatchUp Pro';
  if (product === 'boost') return 'Boost';
  return product;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function OrdersSidebar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(false);

  const isMainApp = pathname === '/';

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/me/orders');
      if (res.ok) {
        const data = await res.json();
        setOrders(Array.isArray(data) ? data : []);
      } else {
        setOrders([]);
      }
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && session) fetchOrders();
  }, [open, session, fetchOrders]);

  if (status !== 'authenticated' || !session || !isMainApp) return null;

  return (
    <>
      {/* Sağda sabit buton */}
      <div className="fixed top-24 right-4 z-40 flex flex-col items-end gap-2">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--matchup-bg-input)] border border-[var(--matchup-border)] text-sm font-medium hover:bg-[var(--matchup-primary)] hover:text-white hover:border-[var(--matchup-primary)] transition-all shadow-lg"
          title="Siparişlerim"
        >
          <i className="fa-solid fa-receipt" />
          <span className="hidden sm:inline">Siparişlerim</span>
        </button>
      </div>

      {/* Açılır panel */}
      {open && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40 sm:bg-transparent sm:inset-auto"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <aside
            className="fixed top-0 right-0 bottom-0 w-full max-w-sm bg-[var(--matchup-bg)] border-l border-[var(--matchup-border)] shadow-2xl z-50 flex flex-col animate-fade-in"
            style={{ fontFamily: 'var(--font-inter)' }}
          >
            <div className="flex items-center justify-between p-4 border-b border-[var(--matchup-border)]">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <i className="fa-solid fa-receipt text-[var(--matchup-primary)]" />
                Siparişlerim
              </h2>
              <button
                onClick={() => setOpen(false)}
                className="p-2 rounded-lg hover:bg-[var(--matchup-bg-input)] text-[var(--matchup-text-muted)]"
                aria-label="Kapat"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12 text-[var(--matchup-text-muted)]">
                  <div className="animate-spin w-10 h-10 border-4 border-[var(--matchup-primary)] border-t-transparent rounded-full" />
                  <p className="mt-3 text-sm">Yükleniyor...</p>
                </div>
              ) : orders.length === 0 ? (
                <div className="text-center py-12 text-[var(--matchup-text-muted)] text-sm">
                  <i className="fa-solid fa-receipt text-4xl mb-3 opacity-50" />
                  <p>Henüz sipariş bulunmuyor.</p>
                  <p className="mt-1">Üyelik veya ödeme yaptığınızda burada listelenecek.</p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {orders.map((order) => (
                    <li
                      key={order.id}
                      className="p-3 rounded-xl bg-[var(--matchup-bg-input)] border border-[var(--matchup-border)]"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <span className="font-medium">{getProductLabel(order.product)}</span>
                        <span className="text-[var(--matchup-primary)] font-semibold whitespace-nowrap">
                          ₺{order.amount}
                        </span>
                      </div>
                      {order.character_name && order.character_name !== '-' && (
                        <p className="text-xs text-[var(--matchup-text-muted)] mt-1">
                          {order.character_name}
                        </p>
                      )}
                      <p className="text-xs text-[var(--matchup-text-muted)] mt-1">
                        {formatDate(order.created_at)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </>
      )}
    </>
  );
}
