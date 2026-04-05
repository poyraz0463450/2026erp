import { useEffect, useState, useMemo } from 'react';
import { Spinner, EmptyState } from '../../components/ui/Shared';
import { getWorkOrders, getWorkCenters } from '../../firebase/firestore';
import { formatDateOnly } from '../../utils/helpers';
import { Calendar, ChevronLeft, ChevronRight, Filter } from 'lucide-react';

const HEADER_HEIGHT = 44;
const ROW_HEIGHT = 56;
const DAY_WIDTH = 60;

export default function GanttPlan() {
  const [orders, setOrders] = useState([]);
  const [centers, setCenters] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Timeline State
  const [startDate, setStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 2)));
  const daysToShow = 21;

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const [o, c] = await Promise.all([getWorkOrders(), getWorkCenters()]);
      setOrders(o.docs.map(x => ({ id: x.id, ...x.data() })).filter(x => x.status !== 'İptal'));
      setCenters(c.docs.map(x => ({ id: x.id, ...x.data() })));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const timelineDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < daysToShow; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    return days;
  }, [startDate]);

  const getDayOffset = (dateStr) => {
    if (!dateStr) return -1;
    const d = new Date(dateStr);
    const diffTime = d.getTime() - startDate.getTime();
    const diffDays = diffTime / (1000 * 3600 * 24);
    return diffDays;
  };

  if (loading) return <Spinner />;

  return (
    <div className="anim-fade" style={{ padding: '24px', maxWidth: 1600, margin: '0 auto', height: 'calc(100vh - 56px)', display: 'flex', flexDirection: 'column' }}>
       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
             <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', margin: 0 }}>Üretim Takvimi (Gantt)</h1>
             <p style={{ color: '#475569', fontSize: 13, marginTop: 4 }}>İş emri termin planlama ve istasyon doluluk görünümü</p>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
             <button onClick={() => setStartDate(new Date(startDate.setDate(startDate.getDate() - 7)))} style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 6, width: 32, height: 32, color: '#64748b', cursor: 'pointer' }}><ChevronLeft size={16}/></button>
             <span style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9', minWidth: 140, textAlign: 'center' }}>{formatDateOnly(timelineDays[0])} — {formatDateOnly(timelineDays[daysToShow-1])}</span>
             <button onClick={() => setStartDate(new Date(startDate.setDate(startDate.getDate() + 7)))} style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 6, width: 32, height: 32, color: '#64748b', cursor: 'pointer' }}><ChevronRight size={16}/></button>
             <div style={{ width: 1, height: 24, background: '#1e293b', margin: '0 8px' }} />
             <button style={{ height: 32, padding: '0 12px', background: 'transparent', border: '1px solid #1e293b', borderRadius: 4, color: '#64748b', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}><Filter size={14}/> Filtrele</button>
          </div>
       </div>

       <div style={{ flex: 1, background: '#0d1117', border: '1px solid #1e293b', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* GANTT HEADER */}
          <div style={{ display: 'flex', borderBottom: '1px solid #1e293b' }}>
             <div style={{ width: 200, flexShrink: 0, padding: 12, borderRight: '1px solid #1e293b', background: '#0a0f1e', fontSize: 11, fontWeight: 800, color: '#475569' }}>İŞ MERKEZİ / MAKİNE</div>
             <div style={{ flex: 1, overflowX: 'auto', display: 'flex' }}>
                {timelineDays.map((d, i) => {
                  const isToday = d.toDateString() === new Date().toDateString();
                  const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                  return (
                    <div key={i} style={{ width: DAY_WIDTH, flexShrink: 0, padding: 8, textAlign: 'center', borderRight: '1px solid #1a2332', background: isToday ? '#1e1b4b' : (isWeekend ? '#0a0f1e' : 'transparent') }}>
                       <p style={{ margin: 0, fontSize: 9, color: isToday ? '#60a5fa' : '#475569', fontWeight: 800 }}>{['PAZ','PT','SA','ÇR','PE','CU','CM'][d.getDay()]}</p>
                       <p style={{ margin: 0, fontSize: 12, color: isToday ? '#fff' : '#94a3b8', fontWeight: 700 }}>{d.getDate()}</p>
                    </div>
                  );
                })}
             </div>
          </div>

          {/* GANTT ROWS */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
             {centers.map(center => (
                <div key={center.id} style={{ display: 'flex', borderBottom: '1px solid #1a2332', minHeight: ROW_HEIGHT }}>
                   <div style={{ width: 200, flexShrink: 0, padding: '12px 16px', borderRight: '1px solid #1e293b', background: '#0a0f1e', display: 'flex', alignItems: 'center' }}>
                      <div>
                         <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#f1f5f9' }}>{center.name}</p>
                         <p style={{ margin: 0, fontSize: 9, color: '#475569', textTransform: 'uppercase' }}>{center.code}</p>
                      </div>
                   </div>
                   <div style={{ flex: 1, position: 'relative', overflowX: 'hidden', background: 'repeating-linear-gradient(90deg, transparent, transparent 59px, #1a2332 60px)' }}>
                      {orders.map(order => {
                         // Check if this order has an operation on this work center
                         const op = order.operations?.find(o => o.workCenterId === center.id);
                         if (!op) return null;

                         const startOffset = getDayOffset(order.plannedStart);
                         const endOffset = getDayOffset(order.plannedEnd);
                         
                         // Visibility check
                         if (endOffset < 0 || startOffset > daysToShow) return null;

                         const left = Math.max(0, startOffset) * DAY_WIDTH;
                         const width = (Math.min(daysToShow, endOffset) - Math.max(0, startOffset) + 0.5) * DAY_WIDTH;

                         return (
                            <div key={order.id} style={{ 
                               position: 'absolute', top: 12, left, width, height: 32, 
                               background: order.status === 'Üretimde' ? '#fbbf24' : (order.status === 'Tamamlandı' ? '#065f46' : '#1e3a8a'),
                               border: `1px solid ${order.status === 'Üretimde' ? '#ca8a04' : '#1e293b'}`,
                               borderRadius: 6, padding: '0 8px', display: 'flex', alignItems: 'center',
                               overflow: 'hidden', zIndex: 10, cursor: 'pointer', transition: 'transform 0.1s'
                            }}
                               onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
                               onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                            >
                               <span style={{ fontSize: 10, fontWeight: 800, color: order.status==='Üretimde'?'#422006':'#fff', whiteSpace: 'nowrap' }}>{order.woNumber}</span>
                            </div>
                         );
                      })}
                   </div>
                </div>
             ))}
             {centers.length === 0 && <EmptyState message="İş merkezi bulunamadı" />}
          </div>
       </div>
    </div>
  );
}
