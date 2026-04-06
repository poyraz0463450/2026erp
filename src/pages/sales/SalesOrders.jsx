import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Calendar, Pencil, Plus, Trash2, User } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import { Spinner, EmptyState } from '../../components/ui/Shared';
import { useAuth } from '../../context/AuthContext';
import { addSalesOrder, addWorkOrder, getCustomers, getModels, getParts, getSalesOrders, updateSalesOrder } from '../../firebase/firestore';
import { formatDate, formatNumber } from '../../utils/helpers';
import { buildProductionRequestForSalesOrder, ensureProductPartForModel, triggerSalesOrderPlanning } from '../../services/salesOrderFlowService';
import { getAvailableStock, getModelBomRows, resolveProductPartForModel } from '../../services/modelBomService';

const TH={background:'#0d1117',color:'#475569',fontSize:11,fontWeight:700,textTransform:'uppercase',padding:'12px 16px',textAlign:'left',borderBottom:'2px solid #1e3a5f'};
const TD={padding:'16px',fontSize:13,color:'#94a3b8',borderBottom:'1px solid #1a2332',verticalAlign:'middle'};
const INPUT={width:'100%',height:40,padding:'0 12px',background:'#0a0f1e',border:'1px solid #334155',borderRadius:8,color:'#e2e8f0',fontSize:13,outline:'none'};
const TEXTAREA={...INPUT,minHeight:88,padding:12,resize:'vertical'};
const STATUS_LABELS={Draft:'Taslak',Confirmed:'Onaylandı','Ready for Shipping':'Sevkiyata Hazır','In Production':'Üretimde',Shipped:'Sevk Edildi',Completed:'Tamamlandı',Cancelled:'İptal'};
const COLOR_OPTIONS=['Standart','Siyah','FDE','OD Green','Titanyum','Diğer'];
const SURFACE_OPTIONS=['Standart','Cerakote','QPQ','Fosfat','Anodize','Diğer'];
const initialForm=()=>({soNumber:`SO-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`,customerId:'',modelId:'',quantity:1,unitPrice:0,currency:'USD',status:'Draft',requestedDate:new Date().toISOString().split('T')[0],colorOption:'Standart',colorCustom:'',surfaceOption:'Standart',surfaceCustom:'',specialRequest:''});
const effectiveValue=(selected,custom)=>selected==='Diğer'?String(custom||'').trim():selected;
const toOptionFormValue=(value,list)=>list.includes(value)?{ selected:value, custom:'' }:{ selected:'Diğer', custom:value||'' };

export default function SalesOrders(){
  const { userDoc,isAdmin,isEngineer } = useAuth();
  const canEdit=isAdmin||isEngineer;
  const actorName=userDoc?.full_name||userDoc?.displayName||userDoc?.email||'Sistem';
  const actorEmail=userDoc?.email||'system@artegon.local';
  const [orders,setOrders]=useState([]); const [customers,setCustomers]=useState([]); const [models,setModels]=useState([]); const [parts,setParts]=useState([]); const [loading,setLoading]=useState(true); const [modal,setModal]=useState(false); const [editId,setEditId]=useState(null); const [form,setForm]=useState(initialForm());

  useEffect(()=>{ load(); },[]);
  const resolveModel=(modelId)=>models.find((model)=>model.id===modelId)||null;
  const resolveModelFromProductPart=(productPartId)=>{ const productPart=parts.find((part)=>part.id===productPartId); const firstUsage=productPart?.usedInModels?.[0]; return firstUsage?resolveModel(firstUsage.modelId):null; };
  const resolveModelProduct=(model)=>model?resolveProductPartForModel({ parts, model }):null;
  const getModelCapacity=(model,productPart=null)=>{ const rows=getModelBomRows(parts,model?.id,productPart,model); if(!rows.length) return 0; let bottleneck=Infinity; rows.forEach((row)=>{ const source=row.sourcePart||parts.find((part)=>part.id===row.partId); const perUnit=Number(row.qty||0); if(!source||perUnit<=0) return; bottleneck=Math.min(bottleneck,Math.floor(getAvailableStock(source)/perUnit)); }); return Number.isFinite(bottleneck)?Math.max(bottleneck,0):0; };

  const modelMeta=useMemo(()=>models.map((model)=>{ const productPart=resolveModelProduct(model); return { ...model, productPart, bomRows:getModelBomRows(parts,model.id,productPart,model), finishedStock:Number(getAvailableStock(productPart)), capacity:getModelCapacity(model,productPart) }; }),[models,parts]);
  const selectedModelMeta=useMemo(()=>modelMeta.find((model)=>model.id===form.modelId)||null,[modelMeta,form.modelId]);

  const load=async()=>{ setLoading(true); try{ const [orderSnap,customerSnap,modelSnap,partSnap]=await Promise.all([getSalesOrders(),getCustomers(),getModels(),getParts()]); setOrders(orderSnap.docs.map((doc)=>({ id:doc.id,...doc.data() }))); setCustomers(customerSnap.docs.map((doc)=>({ id:doc.id,...doc.data() }))); setModels(modelSnap.docs.map((doc)=>({ id:doc.id,...doc.data() }))); setParts(partSnap.docs.map((doc)=>({ id:doc.id,...doc.data() }))); }catch(error){ console.error(error); toast.error('Satış verileri yüklenemedi'); }finally{ setLoading(false); } };

  const openCreateModal=()=>{ setEditId(null); setForm(initialForm()); setModal(true); };

  const openEditModal=(order)=>{ 
    const colorInfo=toOptionFormValue(order.colorOption||'Standart',COLOR_OPTIONS);
    const surfaceInfo=toOptionFormValue(order.surfaceOption||'Standart',SURFACE_OPTIONS);
    setEditId(order.id);
    setForm({
      soNumber: order.soNumber || initialForm().soNumber,
      customerId: order.customerId || '',
      modelId: order.modelId || '',
      quantity: Number(order.quantity || 1),
      unitPrice: Number(order.unitPrice || 0),
      currency: order.currency || 'USD',
      status: order.status || 'Draft',
      requestedDate: (order.requestedDate || new Date().toISOString().split('T')[0]).slice(0,10),
      colorOption: colorInfo.selected,
      colorCustom: colorInfo.custom,
      surfaceOption: surfaceInfo.selected,
      surfaceCustom: surfaceInfo.custom,
      specialRequest: order.specialRequest || ''
    });
    setModal(true);
  };

  const handleDelete=async(order)=>{ 
    if(!canEdit) return;
    if(!confirm(`${order.soNumber || 'Sipariş'} kaydını silmek istiyor musunuz?`)) return;
    try{
      await updateSalesOrder(order.id,{ isDeleted:true, deletedAt:new Date().toISOString(), status:'Cancelled' });
      toast.success('Sipariş silindi');
      await load();
    }catch(error){
      console.error(error);
      toast.error('Sipariş silinemedi');
    }
  };

  const ensureRealProductPart=async(model)=>{ const resolved=resolveModelProduct(model); if(!resolved) throw new Error('Model bulunamadı'); if(!resolved.isVirtual) return resolved; const created=await ensureProductPartForModel({ model, parts }); setParts((prev)=>[...prev,created]); return created; };

  const createWorkOrderForSalesOrder=async(salesOrder,quantityOverride=null)=>{
    const model=resolveModel(salesOrder.modelId)||resolveModelFromProductPart(salesOrder.productPartId);
    if(!model) throw new Error('Siparişe bağlı model bulunamadı');
    const productPart=await ensureRealProductPart(model);
    const payload=await buildProductionRequestForSalesOrder({ salesOrder, model, productPart, parts:[...parts.filter((part)=>part.id!==productPart.id),productPart], quantity:Number(quantityOverride||salesOrder.plannedProductionQty||salesOrder.quantity||0), actorName });
    const docRef=await addWorkOrder(payload);
    await updateSalesOrder(salesOrder.id,{ status:'In Production', workOrderId:docRef.id, workOrderNumber:payload.woNumber, plannedProductionQty:Number(quantityOverride||salesOrder.plannedProductionQty||salesOrder.quantity||0) });
    return { id:docRef.id, woNumber:payload.woNumber };
  };

  const confirmOrder=async(order)=>{ try{ const model=resolveModel(order.modelId); if(!model){ toast.error('Siparişe bağlı model bulunamadı'); return; } const productPart=await ensureRealProductPart(model); const effectiveParts=parts.some((part)=>part.id===productPart.id)?parts:[...parts,productPart]; const reservation=await triggerSalesOrderPlanning({ salesOrder:order, model, productPart, parts:effectiveParts, actorName, actorEmail }); const patch={ status:reservation.productionQty>0?'In Production':'Ready for Shipping', readyStockQty:reservation.readyStockQty, plannedProductionQty:reservation.productionQty, shortageCount:reservation.shortages.length, reservationCompletedAt:new Date().toISOString(), productPartId:productPart.id, productPartNumber:productPart.partNumber, productName:productPart.name }; if(reservation.productionQty>0&&!order.workOrderId){ const workOrder=await createWorkOrderForSalesOrder({ ...order, productPartId:productPart.id, productPartNumber:productPart.partNumber, productName:productPart.name },reservation.productionQty); patch.workOrderId=workOrder.id; patch.workOrderNumber=workOrder.woNumber; await updateSalesOrder(order.id,patch); } else { await updateSalesOrder(order.id,patch); } const prCount=reservation.createdActions?.purchaseRequests?.length||0; const woCount=reservation.createdActions?.workOrders?.length||0; const shortageCount=reservation.shortages?.length||0; if(shortageCount>0){ toast.success(`Sipariş onaylandı. ${shortageCount} eksik kalem tespit edildi, satınalma/üretim bildirimleri açıldı (PR:${prCount}, İÇ ÜR:${woCount}).`); } else { toast.success(reservation.productionQty>0?'Sipariş onaylandı, üretim talebi ve eksik malzeme planı açıldı':'Sipariş onaylandı, hazır mamul sevkiyata ayrıldı'); } await load(); }catch(error){ console.error(error); toast.error('Sipariş onaylanamadı'); } };

  const updateStatus=async(order,status)=>{ if(status==='Confirmed'){ await confirmOrder(order); return; } try{ await updateSalesOrder(order.id,{ status }); toast.success(`Sipariş durumu: ${STATUS_LABELS[status]||status}`); load(); }catch(error){ console.error(error); toast.error('Durum güncellenemedi'); } };

  const handleSubmit=async(event)=>{ event.preventDefault(); try{ const customer=customers.find((item)=>item.id===form.customerId); const model=resolveModel(form.modelId); if(!model){ toast.error('Sipariş için model seçiniz'); return; } if(form.colorOption==='Diğer'&&!form.colorCustom.trim()){ toast.error('Renk için manuel açıklama giriniz'); return; } if(form.surfaceOption==='Diğer'&&!form.surfaceCustom.trim()){ toast.error('Kaplama için manuel açıklama giriniz'); return; } const productPart=await ensureRealProductPart(model); const payload={ ...form, customerName:customer?.name||'', modelId:model.id, modelCode:model.modelCode, modelName:model.modelName, productPartId:productPart.id, productPartNumber:productPart.partNumber, productName:productPart.name, colorOption:effectiveValue(form.colorOption,form.colorCustom), surfaceOption:effectiveValue(form.surfaceOption,form.surfaceCustom), specialRequest:form.specialRequest?.trim()||'' }; if(editId){ await updateSalesOrder(editId,payload); toast.success('Satış siparişi güncellendi'); await load(); }else{ const created=await addSalesOrder({ ...payload, readyStockQty:0, plannedProductionQty:0 }); await confirmOrder({ id:created.id, ...payload, status:'Draft', readyStockQty:0, plannedProductionQty:0 }); toast.success('Satış siparişi oluşturuldu, eksik malzeme analizi tamamlandı'); } setModal(false); setEditId(null); setForm(initialForm()); }catch(error){ console.error(error); toast.error(editId?'Sipariş güncellenemedi':'Sipariş kaydı oluşturulamadı'); } };

  if(loading) return <Spinner />;

  return (
    <div className="anim-fade" style={{ padding:24 }}>
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:32 }}>
        <div>
          <h1 style={{ fontSize:24,fontWeight:900,color:'#fff',margin:0 }}>Satış Siparişleri</h1>
          <p style={{ color:'#475569',fontSize:14,marginTop:4 }}>Sipariş onayında hazır mamul rezervasyonu, üretim ihtiyacı ve eksik malzeme planı otomatik çalışır.</p>
        </div>
        {canEdit?<button onClick={openCreateModal} style={{ display:'flex',alignItems:'center',gap:8,height:44,padding:'0 24px',background:'#dc2626',border:'none',borderRadius:8,color:'#fff',fontSize:13,fontWeight:800,cursor:'pointer' }}><Plus size={18} /> Yeni Sipariş</button>:null}
      </div>

      <div style={{ display:'grid',gridTemplateColumns:'repeat(4, minmax(0, 1fr))',gap:16,marginBottom:20 }}>
        {[{label:'Toplam Sipariş',value:orders.filter((order)=>!order.isDeleted).length,color:'#60a5fa'},{label:'Üretime Giden',value:orders.filter((order)=>!order.isDeleted&&order.status==='In Production').length,color:'#f97316'},{label:'Sevke Hazır',value:orders.filter((order)=>!order.isDeleted&&order.status==='Ready for Shipping').length,color:'#34d399'},{label:'Aktif Model',value:models.filter((model)=>model.isActive).length,color:'#a78bfa'}].map((item)=>(
          <div key={item.label} style={{ background:'#0d1117',border:'1px solid #1e293b',borderRadius:12,padding:18,borderTop:`3px solid ${item.color}` }}>
            <div style={{ fontSize:11,color:'#475569',fontWeight:800,textTransform:'uppercase',marginBottom:8 }}>{item.label}</div>
            <div style={{ fontSize:28,fontWeight:900,color:'#f8fafc' }}>{formatNumber(item.value)}</div>
          </div>
        ))}
      </div>

      <div style={{ background:'#0d1117',border:'1px solid #1e293b',borderRadius:12,overflow:'hidden' }}>
        <table style={{ width:'100%',borderCollapse:'collapse' }}>
          <thead><tr><th style={TH}>Sipariş No</th><th style={TH}>Müşteri</th><th style={TH}>Model</th><th style={{ ...TH,textAlign:'right' }}>Miktar</th><th style={{ ...TH,textAlign:'right' }}>Hazır Mamul</th><th style={{ ...TH,textAlign:'right' }}>BOM Kapasitesi</th><th style={TH}>Termin</th><th style={TH}>Durum</th><th style={{ ...TH,textAlign:'center' }}>Aksiyon</th></tr></thead>
          <tbody>
            {orders.filter((row)=>!row.isDeleted).length===0?(<tr><td colSpan={9} style={{ padding:100 }}><EmptyState message="Henüz satış siparişi girilmemiş." /></td></tr>):orders.filter((row)=>!row.isDeleted).map((order)=>{ const currentModel=modelMeta.find((model)=>model.id===order.modelId)||resolveModelFromProductPart(order.productPartId); const fallbackProduct=parts.find((part)=>part.id===order.productPartId)||null; const finishedStock=Number(currentModel?.finishedStock ?? getAvailableStock(fallbackProduct)); const bomCapacity=Number(currentModel?.capacity ?? 0); return (
              <tr key={order.id}>
                <td style={{ ...TD,fontFamily:'monospace',fontWeight:700,color:'#f1f5f9' }}>{order.soNumber}</td>
                <td style={TD}><div style={{ display:'flex',alignItems:'center',gap:8 }}><User size={14} color="#60a5fa" />{order.customerName||'-'}</div></td>
                <td style={TD}><div style={{ fontSize:11,color:'#475569',fontWeight:800 }}>{order.modelCode||currentModel?.modelCode||'-'}</div><div style={{ fontWeight:700,color:'#e2e8f0' }}>{order.modelName||currentModel?.modelName||order.productName||'-'}</div><div style={{ fontSize:11,color:'#64748b',marginTop:4 }}>Mamul: {order.productPartNumber||fallbackProduct?.partNumber||'-'}</div></td>
                <td style={{ ...TD,textAlign:'right',fontWeight:800,color:'#f8fafc' }}>{formatNumber(order.quantity)}</td>
                <td style={{ ...TD,textAlign:'right',fontWeight:900,color:finishedStock>=Number(order.quantity||0)?'#34d399':'#fbbf24' }}>{formatNumber(finishedStock)}</td>
                <td style={{ ...TD,textAlign:'right',fontWeight:900,color:bomCapacity>0?'#60a5fa':'#f87171' }}>{formatNumber(bomCapacity)}</td>
                <td style={TD}><div style={{ display:'flex',alignItems:'center',gap:6,color:new Date(order.requestedDate)<new Date()?'#f87171':'#94a3b8' }}><Calendar size={14} />{formatDate(order.requestedDate)}</div></td>
                <td style={TD}><span style={{ fontSize:10,fontWeight:900,padding:'4px 10px',borderRadius:6,background:order.status==='Shipped'?'rgba(34,197,94,0.1)':order.status==='In Production'?'rgba(249,115,22,0.12)':'rgba(59,130,246,0.12)',color:order.status==='Shipped'?'#22c55e':order.status==='In Production'?'#fb923c':'#60a5fa' }}>{(STATUS_LABELS[order.status]||order.status||'-').toUpperCase()}</span></td>
                <td style={{ ...TD,textAlign:'center' }}>
                  {order.status==='Draft'?<button onClick={()=>updateStatus(order,'Confirmed')} style={{ height:28,padding:'0 12px',background:'#3b82f6',border:'none',borderRadius:4,color:'white',fontSize:10,fontWeight:800,cursor:'pointer' }}>ONAYLA</button>:null}
                  {order.status==='Confirmed'&&finishedStock>=Number(order.quantity||0)?<button onClick={()=>updateStatus(order,'Ready for Shipping')} style={{ height:28,padding:'0 12px',background:'#10b981',border:'none',borderRadius:4,color:'white',fontSize:10,fontWeight:800,cursor:'pointer' }}>SEVKİYATA HAZIR</button>:null}
                  {canEdit?<div style={{ display:'flex',justifyContent:'center',gap:6,marginTop:6 }}><button onClick={()=>openEditModal(order)} style={{ height:26,padding:'0 10px',background:'#1e40af',border:'none',borderRadius:4,color:'#fff',fontSize:10,fontWeight:700,cursor:'pointer',display:'inline-flex',alignItems:'center',gap:4 }}><Pencil size={11}/>DÜZENLE</button><button onClick={()=>handleDelete(order)} style={{ height:26,padding:'0 10px',background:'#7f1d1d',border:'none',borderRadius:4,color:'#fff',fontSize:10,fontWeight:700,cursor:'pointer',display:'inline-flex',alignItems:'center',gap:4 }}><Trash2 size={11}/>SİL</button></div>:null}
                  {order.workOrderNumber||order.workOrderId?<div style={{ marginTop:6,fontSize:10,color:'#64748b',fontFamily:'monospace' }}>{order.workOrderNumber||order.workOrderId}</div>:null}
                </td>
              </tr>
            );})}
          </tbody>
        </table>
      </div>

      <Modal open={modal} onClose={()=>{ setModal(false); setEditId(null); }} title={editId?'Satış Siparişi Düzenle':'Yeni Satış Siparişi'} width={760}>
        <form onSubmit={handleSubmit} style={{ display:'flex',flexDirection:'column',gap:18 }}>
          <div><label style={{ display:'block',fontSize:11,fontWeight:700,color:'#64748b',marginBottom:6 }}>MÜŞTERİ</label><select style={INPUT} value={form.customerId} onChange={(event)=>setForm((prev)=>({ ...prev,customerId:event.target.value }))} required><option value="">Seçiniz...</option>{customers.map((customer)=><option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></div>
          <div><label style={{ display:'block',fontSize:11,fontWeight:700,color:'#64748b',marginBottom:6 }}>MODEL</label><select style={INPUT} value={form.modelId} onChange={(event)=>setForm((prev)=>({ ...prev,modelId:event.target.value }))} required><option value="">Model seçiniz...</option>{modelMeta.map((model)=><option key={model.id} value={model.id}>{model.modelCode} - {model.modelName}</option>)}</select></div>
          {selectedModelMeta?<div style={{ display:'grid',gridTemplateColumns:'repeat(4, minmax(0, 1fr))',gap:12 }}><div style={{ padding:12,background:'#0a0f1e',border:'1px solid #1e293b',borderRadius:10 }}><div style={{ fontSize:11,color:'#64748b',marginBottom:6 }}>Mamul Kartı</div><div style={{ fontSize:13,color:'#f8fafc',fontWeight:800 }}>{selectedModelMeta.productPart?.partNumber||'Otomatik oluşturulacak'}</div></div><div style={{ padding:12,background:'#0a0f1e',border:'1px solid #1e293b',borderRadius:10 }}><div style={{ fontSize:11,color:'#64748b',marginBottom:6 }}>Hazır Stok</div><div style={{ fontSize:13,color:'#34d399',fontWeight:800 }}>{formatNumber(selectedModelMeta.finishedStock)}</div></div><div style={{ padding:12,background:'#0a0f1e',border:'1px solid #1e293b',borderRadius:10 }}><div style={{ fontSize:11,color:'#64748b',marginBottom:6 }}>BOM Kapasitesi</div><div style={{ fontSize:13,color:'#60a5fa',fontWeight:800 }}>{formatNumber(selectedModelMeta.capacity)}</div></div><div style={{ padding:12,background:'#0a0f1e',border:'1px solid #1e293b',borderRadius:10 }}><div style={{ fontSize:11,color:'#64748b',marginBottom:6 }}>BOM Kalemi</div><div style={{ fontSize:13,color:'#f8fafc',fontWeight:800 }}>{formatNumber(selectedModelMeta.bomRows.length)}</div></div></div>:null}
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:16 }}>
            <div><label style={{ display:'block',fontSize:11,fontWeight:700,color:'#64748b',marginBottom:6 }}>TERMIN TARİHİ</label><input type="date" style={INPUT} value={form.requestedDate} onChange={(event)=>setForm((prev)=>({ ...prev,requestedDate:event.target.value }))} required /></div>
            <div><label style={{ display:'block',fontSize:11,fontWeight:700,color:'#64748b',marginBottom:6 }}>MİKTAR</label><input type="number" min="1" style={INPUT} value={form.quantity} onChange={(event)=>setForm((prev)=>({ ...prev,quantity:Number(event.target.value) }))} required /></div>
            <div><label style={{ display:'block',fontSize:11,fontWeight:700,color:'#64748b',marginBottom:6 }}>RENK / KONFİGÜRASYON</label><select style={INPUT} value={form.colorOption} onChange={(event)=>setForm((prev)=>({ ...prev,colorOption:event.target.value }))}>{COLOR_OPTIONS.map((option)=><option key={option} value={option}>{option}</option>)}</select></div>
            <div><label style={{ display:'block',fontSize:11,fontWeight:700,color:'#64748b',marginBottom:6 }}>KAPLAMA / YÜZEY</label><select style={INPUT} value={form.surfaceOption} onChange={(event)=>setForm((prev)=>({ ...prev,surfaceOption:event.target.value }))}>{SURFACE_OPTIONS.map((option)=><option key={option} value={option}>{option}</option>)}</select></div>
            {form.colorOption==='Diğer'?<div><label style={{ display:'block',fontSize:11,fontWeight:700,color:'#64748b',marginBottom:6 }}>Renk Açıklaması</label><input style={INPUT} value={form.colorCustom} onChange={(event)=>setForm((prev)=>({ ...prev,colorCustom:event.target.value }))} placeholder="Örn: koyu FDE" /></div>:null}
            {form.surfaceOption==='Diğer'?<div><label style={{ display:'block',fontSize:11,fontWeight:700,color:'#64748b',marginBottom:6 }}>Kaplama Açıklaması</label><input style={INPUT} value={form.surfaceCustom} onChange={(event)=>setForm((prev)=>({ ...prev,surfaceCustom:event.target.value }))} placeholder="Örn: özel mat kaplama" /></div>:null}
            <div><label style={{ display:'block',fontSize:11,fontWeight:700,color:'#64748b',marginBottom:6 }}>BİRİM FİYAT</label><input type="number" min="0" step="0.01" style={INPUT} value={form.unitPrice} onChange={(event)=>setForm((prev)=>({ ...prev,unitPrice:Number(event.target.value) }))} /></div>
            <div><label style={{ display:'block',fontSize:11,fontWeight:700,color:'#64748b',marginBottom:6 }}>PARA BİRİMİ</label><select style={INPUT} value={form.currency} onChange={(event)=>setForm((prev)=>({ ...prev,currency:event.target.value }))}><option value="USD">USD ($)</option><option value="EUR">EUR (€)</option><option value="TRY">TRY (₺)</option></select></div>
          </div>
          <div><label style={{ display:'block',fontSize:11,fontWeight:700,color:'#64748b',marginBottom:6 }}>ÖZEL İSTEK / NOT</label><textarea style={TEXTAREA} value={form.specialRequest} onChange={(event)=>setForm((prev)=>({ ...prev,specialRequest:event.target.value }))} placeholder="Müşteri özel isteğini yazın." /></div>
          <button type="submit" style={{ height:44,background:'#dc2626',border:'none',color:'#fff',fontSize:14,fontWeight:800,borderRadius:8,cursor:'pointer' }}>{editId?'SİPARİŞİ GÜNCELLE':'SİPARİŞİ OLUŞTUR'}</button>
        </form>
      </Modal>
    </div>
  );
}
