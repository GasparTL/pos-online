import { useState, useEffect } from 'react'
import './App.css'

function App() {

  // --- PERSISTENCIA Y AUTENTICACIÓN ---
  const [isLoggedIn, setIsLoggedIn] = useState(() => localStorage.getItem('isLoggedIn') === 'true');
  const [activeView, setActiveView] = useState(() => localStorage.getItem('activeView') || 'dashboard');
  const [cart, setCart] = useState(() => JSON.parse(localStorage.getItem('currentCart')) || []);
  
  // Estados para el Login Funcional y Setup
  const [isSetupComplete, setIsSetupComplete] = useState(true);
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [currentUser, setCurrentUser] = useState(() => JSON.parse(localStorage.getItem('currentUser')) || null);

  // --- ESTADOS DE CONFIGURACIÓN (Módulo 2) ---
  const [appName, setAppName] = useState('MI TIENDITA')
  const [primaryColor, setPrimaryColor] = useState('#1e293b')
  const [accentColor, setAccentColor] = useState('#3b82f6')
  const [tempAppName, setTempAppName] = useState(appName)
  const [tempPrimaryColor, setTempPrimaryColor] = useState(primaryColor)
  const [tempAccentColor, setTempAccentColor] = useState(accentColor)

  const handleSaveSettings = (e) => {
    e.preventDefault()
    setAppName(tempAppName); setPrimaryColor(tempPrimaryColor); setAccentColor(tempAccentColor);
    alert('¡Configuración guardada con éxito!')
  }

  const themeStyles = { '--primary-color': primaryColor, '--accent-color': accentColor }

  // --- LÓGICA MÓDULO 1 (USUARIOS Y PERMISOS) ---
  const defaultAdminPerms = { ventas: true, inventario: true, reportes: true, compras: true, usuarios: true, configuracion: true };
  const [users, setUsers] = useState([])
  
  const [newUser, setNewUser] = useState({
    name: '', username: '', password: '', role: 'Administrador', permissions: { ...defaultAdminPerms }
  })

  const fetchUsers = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/users');
      if (res.ok) setUsers(await res.json());
    } catch (e) { console.log("Error al cargar usuarios", e); }
  }

  const handlePermissionChange = (perm) => {
    setNewUser({ ...newUser, permissions: { ...newUser.permissions, [perm]: !newUser.permissions[perm] } })
  }

  const handleRoleChange = (e) => {
    const role = e.target.value;
    let perms = { ...newUser.permissions };
    
    if (role === 'Administrador') {
      perms = { ventas: true, inventario: true, reportes: true, compras: true, usuarios: true, configuracion: true };
    } else if (role === 'Vendedor') {
      perms = { ventas: true, inventario: false, reportes: false, compras: false, usuarios: false, configuracion: false };
    } else if (role === 'Cajero') {
      perms = { ventas: true, inventario: false, reportes: true, compras: false, usuarios: false, configuracion: false };
    }
    
    setNewUser({ ...newUser, role, permissions: perms });
  }

  const handleCreateUser = async (e) => {
    e.preventDefault()
    if (!newUser.name || !newUser.username || !newUser.password) {
      alert("Por favor, llena todos los datos del usuario."); return;
    }
    
    // Si estamos en Setup Inicial
    if (!isSetupComplete) {
      try {
        const res = await fetch('http://localhost:5000/api/system/setup', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newUser)
        });
        if (res.ok) {
          alert("¡Primer Administrador creado! Ahora puedes iniciar sesión.");
          setIsSetupComplete(true);
          setNewUser({ name: '', username: '', password: '', role: 'Administrador', permissions: { ...defaultAdminPerms } });
        } else {
          const data = await res.json(); alert(data.error);
        }
      } catch (e) { alert("Error al conectar con el servidor.",e);}
      return;
    }

    // Creación normal (Solo Admin)
    if (currentUser?.role !== 'Administrador') return alert("Solo un Administrador puede crear usuarios.");
    
    try {
      const res = await fetch('http://localhost:5000/api/users', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newUser)
      });
      if (res.ok) {
        alert(`¡Usuario ${newUser.name} creado con éxito!`);
        fetchUsers();
        setNewUser({ name: '', username: '', password: '', role: 'Administrador', permissions: { ...defaultAdminPerms } });
      } else {
        const data = await res.json(); alert(data.error);
      }
    } catch (e) { alert("Error al crear usuario."),e; }
  }

  const handleDeleteUser = async (id) => {
    if (currentUser?.role !== 'Administrador') return alert("Solo un Administrador puede eliminar usuarios.");
    if (currentUser?.id === id) return alert("No puedes eliminarte a ti mismo.");
    if (!window.confirm("¿Estás seguro de eliminar este usuario?")) return;

    try {
      const res = await fetch(`http://localhost:5000/api/users/${id}`, { method: 'DELETE' });
      if (res.ok) {
        alert("Usuario eliminado.");
        fetchUsers();
      }
    } catch (e) { alert("Error al eliminar usuario."),e; }
  }

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:5000/api/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(loginData)
      });
      const data = await res.json();
      if (res.ok) {
        setCurrentUser(data);
        setIsLoggedIn(true);
        localStorage.setItem('currentUser', JSON.stringify(data));
        setLoginData({ username: '', password: '' });
      } else {
        alert(data.error);
      }
    } catch (e) { alert("Error de conexión. ¿El servidor está encendido?",e)}
  }

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentUser(null);
    setActiveView('dashboard');
    localStorage.removeItem('currentUser');
    localStorage.removeItem('isLoggedIn');
  }

  // --- EFECTOS INICIALES ---
  useEffect(() => {
    fetch('http://localhost:5000/api/system/check-setup')
      .then(res => res.json())
      .then(data => setIsSetupComplete(data.isSetupComplete))
      .catch(() => console.log("Esperando servidor..."));
  }, []);

  useEffect(() => {
    localStorage.setItem('isLoggedIn', isLoggedIn);
    localStorage.setItem('activeView', activeView);
    localStorage.setItem('currentCart', JSON.stringify(cart));
  }, [isLoggedIn, activeView, cart]);

useEffect(() => {
    fetch('http://localhost:5000/api/system/check-setup')
      .then(res => res.json())
      .then(data => setIsSetupComplete(data.isSetupComplete))
      .catch(() => console.log("Esperando servidor..."));
  }, []);

  useEffect(() => {
    localStorage.setItem('isLoggedIn', isLoggedIn);
    localStorage.setItem('activeView', activeView);
    localStorage.setItem('currentCart', JSON.stringify(cart));
  }, [isLoggedIn, activeView, cart]);
const [inventory, setInventory] = useState([])
  const [salesHistory, setSalesHistory] = useState([]);
  useEffect(() => {
    const fetchData = async () => {
      try {
        const resP = await fetch('http://localhost:5000/api/products');
        setInventory(await resP.json()); // 🟢 Ahora sí existe cuando llega aquí
        
        const resS = await fetch('http://localhost:5000/api/sales');
        setSalesHistory(await resS.json()); // 🟢 Y esta también

        fetchUsers();
      } catch (e) { console.log("Servidor no conectado.", e); }
    };
    if (isLoggedIn) fetchData();
  }, [isLoggedIn]);

  // --- BASE DE DATOS Y ESTADOS GLOBALES ---
  
  const [categories, setCategories] = useState(['Lácteos', 'Carnes', 'Abarrotes', 'Bebidas'])

  
  // --- LÓGICA MÓDULO 4 (TICKETS Y COMPRAS) ---
  const [ticketTab, setTicketTab] = useState('captura')
  const [ticketItems, setTicketItems] = useState([])
  const [newItem, setNewItem] = useState({ sku: '', desc: '', qty: 1, unitPrice: '' })
  const [ticketMeta, setTicketMeta] = useState({ provider: '', date: '' })
  const [selectedTicket, setSelectedTicket] = useState(null)
  
  const [ticketHistory, setTicketHistory] = useState([
    { id: 'TKT-002', date: '2026-04-01', provider: 'Comercializadora Bimbo', items: [{sku: '101', desc: 'Pan Blanco Grande', qty: 50, unitPrice: 70, itemTotal: 3500}], subtotal: 3500.00, iva: 560.00, total: 4060.00 },
    { id: 'TKT-001', date: '2026-04-02', provider: 'Coca-Cola FEMSA', items: [{sku: '202', desc: 'Refresco Cola 600ml', qty: 100, unitPrice: 10, itemTotal: 1000}], subtotal: 1000.00, iva: 160.00, total: 1160.00 }
  ])

  const handleAddItemToTicket = () => {
    if (!newItem.sku || !newItem.desc || newItem.qty <= 0 || newItem.unitPrice <= 0) {
      alert("Por favor llena todos los datos del producto correctamente."); return;
    }
    const itemTotal = Number(newItem.qty) * Number(newItem.unitPrice)
    setTicketItems([...ticketItems, { ...newItem, itemTotal }])
    setNewItem({ sku: '', desc: '', qty: 1, unitPrice: '' })
  }

  const handleRemoveItemFromTicket = (index) => {
    const updatedItems = ticketItems.filter((_, i) => i !== index)
    setTicketItems(updatedItems)
  }

  const ticketSubtotal = ticketItems.reduce((sum, item) => sum + item.itemTotal, 0)
  const ticketIVA = ticketSubtotal * 0.16
  const ticketTotal = ticketSubtotal + ticketIVA

  const handleSaveTicket = (e) => {
    e.preventDefault()
    if (ticketItems.length === 0) { alert("El ticket está vacío."); return; }
    if (!ticketMeta.provider || !ticketMeta.date) { alert("Debes seleccionar un proveedor y una fecha."); return; }

    let updatedInventory = [...inventory]

    ticketItems.forEach(ticketProd => {
      const existingProdIndex = updatedInventory.findIndex(invProd => invProd.sku === ticketProd.sku)
      if (existingProdIndex >= 0) {
        updatedInventory[existingProdIndex].stock += Number(ticketProd.qty)
        updatedInventory[existingProdIndex].costPrice = Number(ticketProd.unitPrice)
      } else {
        updatedInventory.push({
          sku: ticketProd.sku, name: ticketProd.desc, category: 'Por clasificar',
          stock: Number(ticketProd.qty), costPrice: Number(ticketProd.unitPrice), salePrice: Number(ticketProd.unitPrice) * 1.3, expiry: '', image: ''
        })
      }
    })

    const newTicketId = `TKT-${(ticketHistory.length + 1).toString().padStart(3, '0')}`;
    const newHistoryRecord = { id: newTicketId, date: ticketMeta.date, provider: ticketMeta.provider, items: [...ticketItems], subtotal: ticketSubtotal, iva: ticketIVA, total: ticketTotal }
    
    setTicketHistory([newHistoryRecord, ...ticketHistory])
    setInventory(updatedInventory)
    setTicketItems([])
    setTicketMeta({ provider: '', date: '' })
    alert(`¡Ticket guardado exitosamente como ${newTicketId}!`)
  }

  const historyTotalSubtotal = ticketHistory.reduce((sum, t) => sum + t.subtotal, 0)
  const historyTotalIVA = ticketHistory.reduce((sum, t) => sum + t.iva, 0)
  const historyTotalGasto = ticketHistory.reduce((sum, t) => sum + t.total, 0)

  const renderTicketModal = () => {
    if (!selectedTicket) return null;
    return (
      <div className="modal-overlay" onClick={() => setSelectedTicket(null)}>
        <div className="modal-content receipt-style" onClick={e => e.stopPropagation()}>
          <div className="receipt-header">
            <h2 style={{fontSize: '1.5rem', marginBottom: '0.5rem'}}>{appName}</h2><p><strong>REGISTRO CONTABLE DE COMPRA</strong></p>
            <p>ID Transacción: {selectedTicket.id}</p><p>Fecha: {selectedTicket.date}</p><p style={{marginTop: '0.5rem'}}><strong>Proveedor:</strong><br/>{selectedTicket.provider}</p>
          </div>
          <table className="receipt-table">
            <thead><tr><th style={{textAlign: 'left', width: '15%'}}>CANT</th><th style={{textAlign: 'left', width: '55%'}}>DESCRIPCIÓN</th><th style={{textAlign: 'right', width: '30%'}}>IMPORTE</th></tr></thead>
            <tbody>
              {selectedTicket.items.map((item, idx) => (
                <tr key={idx}><td style={{verticalAlign: 'top'}}>{item.qty}</td><td style={{paddingBottom: '0.5rem'}}>{item.desc}<br/><small style={{color: '#666'}}>${Number(item.unitPrice).toFixed(2)} c/u</small></td><td style={{textAlign: 'right', verticalAlign: 'top'}}>${item.itemTotal.toFixed(2)}</td></tr>
              ))}
            </tbody>
          </table>
          <div className="receipt-totals">
            <p>SUBTOTAL: <span>${selectedTicket.subtotal.toFixed(2)}</span></p><p>IVA (16%): <span>${selectedTicket.iva.toFixed(2)}</span></p><h3 style={{fontSize: '1.2rem', marginTop: '0.5rem'}}>TOTAL PAGADO: <span>${selectedTicket.total.toFixed(2)}</span></h3>
          </div>
          <div className="modal-actions"><button className="print-btn" onClick={() => window.print()}>🖨️ Imprimir Ticket</button><button className="close-modal-btn" onClick={() => setSelectedTicket(null)}>Cerrar</button></div>
        </div>
      </div>
    )
  }

  // --- LÓGICA MÓDULO 5 (INVENTARIO / REGISTRO DE PRODUCTOS) ---
  const [inventoryTab, setInventoryTab] = useState('catalogo')
  const [formMode, setFormMode] = useState('idle') 
  const [editForm, setEditForm] = useState(null)
  const [catalogSearch, setCatalogSearch] = useState('')
  
  const [newCatName, setNewCatName] = useState('')
  const [newManualProduct, setNewManualProduct] = useState({
    sku: '', name: '', category: 'Por clasificar', stock: 1, costPrice: '', salePrice: '', expiry: '', image: ''
  })

  const handleImageUpload = (e, setter, currentState) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setter({ ...currentState, image: reader.result });
      };
      reader.readAsDataURL(file);
    }
  }

  const checkExpiryStatus = (expiryDateStr) => {
    if (!expiryDateStr) return { status: 'neutral', text: 'Sin fecha' };
    const today = new Date();
    const expDate = new Date(expiryDateStr);
    const diffTime = expDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { status: 'danger', text: '¡CADUCADO!' };
    if (diffDays <= 7) return { status: 'warning', text: 'Próximo a vencer' };
    return { status: 'ok', text: 'Vigente' };
  }

  const handleEditClick = (product) => {
    setInventoryTab('clasificacion')
    setFormMode('edit')
    setEditForm({ ...product })
  }

  const handleSaveProductEdit = async (e) => {
    e.preventDefault()
    if(!editForm) return;
    try {
      const res = await fetch('http://localhost:5000/api/products', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editForm)
      });
      if(res.ok) {
        setInventory(inventory.map(prod => prod.sku === editForm.sku ? editForm : prod));
        setFormMode('idle'); setEditForm(null); alert('Producto actualizado.');
      }
    } catch(e) { alert("Error al guardar en BD",e); }
  }

  const handleAddNewCategory = (e) => {
    e.preventDefault()
    if(!newCatName.trim()) return;
    if(categories.includes(newCatName)) {
      alert("Esta categoría ya existe."); return;
    }
    setCategories([...categories, newCatName])
    setNewCatName('')
    setFormMode('idle')
    alert(`Categoría "${newCatName}" agregada con éxito.`)
  }

  const handleSaveNewManualProduct = async (e) => {
    e.preventDefault()
    if(!newManualProduct.sku || !newManualProduct.name) {
      alert("El SKU y el Nombre son obligatorios."); return;
    }
    const exists = inventory.some(p => p.sku === newManualProduct.sku)
    if(exists) {
      alert("Ya existe un producto con este SKU."); return;
    }

    const productToSave = {
      ...newManualProduct,
      stock: Number(newManualProduct.stock),
      costPrice: Number(newManualProduct.costPrice),
      salePrice: Number(newManualProduct.salePrice)
    };

    try {
      const res = await fetch('http://localhost:5000/api/products', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(productToSave)
      });
      if(res.ok) {
        setInventory([...inventory, productToSave]);
        setFormMode('idle'); 
        setNewManualProduct({sku: '', name: '', category: 'Por clasificar', stock: 1, costPrice: '', salePrice: '', expiry: '', image: ''});
        alert('Producto agregado.');
      }
    } catch(e) { alert("Error al guardar en BD",e); }
  }

  const totalStockItems = inventory.reduce((sum, p) => sum + p.stock, 0)
  const totalCostValue = inventory.reduce((sum, p) => sum + (p.stock * p.costPrice), 0)
  const totalSaleValue = inventory.reduce((sum, p) => sum + (p.stock * p.salePrice), 0)
  const expectedProfit = totalSaleValue - totalCostValue

  const filteredCatalog = inventory.filter(p => 
    p.name.toLowerCase().includes(catalogSearch.toLowerCase()) || 
    p.sku.includes(catalogSearch)
  );

  // --- LÓGICA MÓDULO 6 (PUNTO DE VENTA Y VENTAS GLOBALES) ---
  const [searchSku, setSearchSku] = useState('')
  const [checkoutModal, setCheckoutModal] = useState(false)
  const [paymentData, setPaymentData] = useState({ method: 'efectivo', cashGiven: '', cardCommissionPct: 3 })
  const [saleTicket, setSaleTicket] = useState(null)

  const handleDbInitialize = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/db/initialize', { method: 'POST' });
      if (res.ok) {
        alert("✅ Base de datos cargada y lista.");
        window.location.reload();
      }
    } catch (e) { alert("❌ Error al conectar con el servidor local para iniciar la DB.",e);}
  };

  const handleDbClear = async () => {
    if (!window.confirm("⚠️ ¿Borrar TODO el inventario y ventas?")) return;
    try {
      const res = await fetch('http://localhost:5000/api/db/clear', { method: 'POST' });
      if (res.ok) { 
        alert("✅ Sistema limpio."); 
        window.location.reload(); 
      }
    } catch (e) { alert("❌ Error al conectar con el servidor.",e);}
  };

  const handleDbSave = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/db/save', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inventory, sales: salesHistory })
      });
      if (res.ok) alert("💾 Información guardada exitosamente en el archivo local.");
    } catch (e) { alert("❌ Error al conectar con la ruta /api/db/save.",e);}
  };


  const handleSearchAndAddToCart = (e) => {
    e.preventDefault();
    if (!searchSku.trim()) return;
    
    const product = inventory.find(p => p.sku === searchSku || p.name.toLowerCase().includes(searchSku.toLowerCase()));
    if (!product) {
      alert("Producto no encontrado en el inventario.");
      return;
    }
    if (product.stock <= 0) {
      alert("¡Producto agotado!");
      return;
    }

    addToCart(product);
    setSearchSku('');
  }

  const addToCart = (product) => {
    const existingItem = cart.find(item => item.sku === product.sku);
    if (existingItem) {
      if (existingItem.qty >= product.stock) {
        alert("No hay suficiente stock disponible."); return;
      }
      setCart(cart.map(item => item.sku === product.sku ? { ...item, qty: item.qty + 1, total: (item.qty + 1) * item.salePrice } : item));
    } else {
      setCart([...cart, { ...product, qty: 1, total: product.salePrice }]);
    }
  }

  const removeFromCart = (sku) => {
    setCart(cart.filter(item => item.sku !== sku));
  }

  const cartSubtotal = cart.reduce((sum, item) => sum + item.total, 0);
  const commissionAmount = paymentData.method === 'tarjeta' ? cartSubtotal * (paymentData.cardCommissionPct / 100) : 0;
  const cartTotalFinal = cartSubtotal + commissionAmount;
  const changeToGive = paymentData.method === 'efectivo' ? Number(paymentData.cashGiven) - cartTotalFinal : 0;

  const handleProcessSale = async (e) => {
    e.preventDefault();
    
    if (paymentData.method === 'efectivo' && changeToGive < 0) {
      alert("El efectivo recibido es menor al total a pagar."); return;
    }

    const cartTotalCost = cart.reduce((sum, item) => sum + (item.costPrice * item.qty), 0);
    const saleProfit = cartSubtotal - cartTotalCost;

    const newTicket = {
      id: `VTA-${Date.now().toString().slice(-6)}`,
      date: new Date().toISOString(),
      displayDate: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString(),
      items: [...cart],
      subtotal: cartSubtotal,
      commission: commissionAmount,
      total: cartTotalFinal,
      profit: saleProfit,
      method: paymentData.method,
      cashGiven: paymentData.method === 'efectivo' ? Number(paymentData.cashGiven) : null,
      change: changeToGive
    };

    try {
      const res = await fetch('http://localhost:5000/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTicket)
      });

      if (res.ok) {
        setSalesHistory([newTicket, ...salesHistory]);
        
        setInventory(inventory.map(inv => {
            const sold = cart.find(c => c.sku === inv.sku);
            return sold ? { ...inv, stock: inv.stock - sold.qty } : inv;
        }));
        
        setSaleTicket(newTicket); 
        setCart([]);
        setCheckoutModal(false);
        setPaymentData({ method: 'efectivo', cashGiven: '', cardCommissionPct: 3 }); 
      } else {
        alert("Hubo un problema al procesar la venta en el servidor.");
      }
    } catch {
      alert("Error de conexión con el servidor local. Enciende tu Backend.");
    }
  }

  // --- LÓGICA MÓDULO 9 (AJUSTES DE INVENTARIO) ---
  const [adjustData, setAdjustData] = useState({ sku: '', type: 'salida', qty: 1, reason: 'Merma / Dañado' })
  const [adjustmentHistory, setAdjustmentHistory] = useState([])

  const handleApplyAdjustment = async (e) => {
    e.preventDefault()
    if (!adjustData.sku || adjustData.qty <= 0) {
      alert("Por favor ingresa un SKU válido y una cantidad mayor a 0.")
      return
    }

    const prodIndex = inventory.findIndex(p => p.sku === adjustData.sku)
    if (prodIndex === -1) {
      alert("Producto no encontrado.")
      return
    }

    let updatedInventory = [...inventory]
    let currentStock = updatedInventory[prodIndex].stock

    if (adjustData.type === 'salida' && currentStock < adjustData.qty) {
      alert("No puedes retirar más stock del que existe.")
      return
    }

    const newStock = adjustData.type === 'entrada' 
      ? currentStock + Number(adjustData.qty) 
      : currentStock - Number(adjustData.qty)

    updatedInventory[prodIndex].stock = newStock

    try {
      const res = await fetch('http://localhost:5000/api/products', { 
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updatedInventory[prodIndex]) 
      });
      if (res.ok) {
        const newRecord = {
          dateISO: new Date().toISOString(),
          date: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString(),
          sku: adjustData.sku,
          name: updatedInventory[prodIndex].name,
          type: adjustData.type,
          qty: adjustData.qty,
          reason: adjustData.reason,
          unitCost: updatedInventory[prodIndex].costPrice, 
          oldStock: currentStock,
          newStock: newStock
        }

        setInventory(updatedInventory)
        setAdjustmentHistory([newRecord, ...adjustmentHistory])
        setAdjustData({ sku: '', type: 'salida', qty: 1, reason: 'Merma / Dañado' })
        alert("¡Ajuste de inventario aplicado correctamente!")
      }
    } catch { alert("Error al guardar ajuste."); }
  }

  // --- LÓGICA MÓDULO 7 (REPORTES FINANCIEROS) ---
  const [reportPeriod, setReportPeriod] = useState('hoy')

  const filterByPeriod = (dateISOString, period) => {
    if (!dateISOString) return true;
    const dateObj = new Date(dateISOString);
    const now = new Date();
    const diffTime = Math.abs(now - dateObj);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (period === 'hoy') return diffDays <= 1;
    if (period === 'semana') return diffDays <= 7;
    if (period === 'mes') return diffDays <= 30;
    if (period === 'anio') return diffDays <= 365;
    return true;
  }

  const filteredSales = salesHistory.filter(sale => filterByPeriod(sale.date, reportPeriod));
  const filteredPurchases = ticketHistory.filter(ticket => filterByPeriod(ticket.date, reportPeriod));
  const filteredAdjustments = adjustmentHistory.filter(adj => filterByPeriod(adj.dateISO, reportPeriod) && adj.type === 'salida');

  const reportTotalVentas = filteredSales.reduce((sum, sale) => sum + sale.total, 0);
  const reportTotalGanancias = filteredSales.reduce((sum, sale) => sum + sale.profit, 0);
  const reportTotalCompras = filteredPurchases.reduce((sum, ticket) => sum + ticket.total, 0);
  const reportTotalPerdidas = filteredAdjustments.reduce((sum, adj) => sum + (Number(adj.qty) * adj.unitCost), 0);

  const totalEgresosIngresos = reportTotalVentas + reportTotalCompras + reportTotalPerdidas || 1; 
  const degVentas = (reportTotalVentas / totalEgresosIngresos) * 360;
  const degCompras = (reportTotalCompras / totalEgresosIngresos) * 360;

  const pieChartStyle = {
    width: '220px', height: '220px', borderRadius: '50%',
    background: `conic-gradient(#10b981 0deg ${degVentas}deg, #f59e0b ${degVentas}deg ${degVentas + degCompras}deg, #ef4444 ${degVentas + degCompras}deg 360deg)`,
    boxShadow: 'var(--shadow-md)', margin: '0 auto'
  }

  const handleExportExcel = () => {
    let csvContent = "\uFEFF"; 
    csvContent += `REPORTE FINANCIERO - PERIODO: ${reportPeriod.toUpperCase()}\n\n`;
    csvContent += "RESUMEN GENERAL\nConcepto,Monto\n";
    csvContent += `Ingresos por Ventas,$${reportTotalVentas.toFixed(2)}\n`;
    csvContent += `Gasto en Compras,$${reportTotalCompras.toFixed(2)}\n`;
    csvContent += `Pérdidas (Mermas/Daños),$${reportTotalPerdidas.toFixed(2)}\n`;
    csvContent += `Ganancia Neta Libre,$${reportTotalGanancias.toFixed(2)}\n\n`;
    csvContent += "DESGLOSE DE VENTAS DEL PERIODO\nID Ticket,Fecha,Metodo de Pago,Subtotal,Comision Bancaria,Total Pagado,Utilidad Neta\n";
    filteredSales.forEach(sale => {
      const cleanMethod = sale.method.replace(/,/g, '');
      csvContent += `${sale.id},${sale.displayDate || sale.date},${cleanMethod},${sale.subtotal.toFixed(2)},${sale.commission.toFixed(2)},${sale.total.toFixed(2)},${sale.profit.toFixed(2)}\n`;
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Reporte_Financiero_${reportPeriod}_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // --- LÓGICA MÓDULO 8 (WHATSAPP STORE Y GESTIÓN DE PEDIDOS) ---
  const [waTab, setWaTab] = useState('pedidos'); 
  const [waNumber, setWaNumber] = useState('525512345678'); 
  const [waOrders, setWaOrders] = useState([]); 
  const [waClientName, setWaClientName] = useState('');
  const [waClientCart, setWaClientCart] = useState([]);

  const addToWaCart = (product) => {
    const existing = waClientCart.find(item => item.sku === product.sku);
    if (existing) {
      if (existing.qty >= product.stock) {
        alert("Stock máximo alcanzado."); return;
      }
      setWaClientCart(waClientCart.map(item => item.sku === product.sku ? { ...item, qty: item.qty + 1, total: (item.qty + 1) * item.salePrice } : item));
    } else {
      setWaClientCart([...waClientCart, { ...product, qty: 1, total: product.salePrice }]);
    }
  }

  const handleSendWaOrder = () => {
    if(!waClientName) { alert("Ingresa tu nombre para enviar el pedido."); return; }
    if(waClientCart.length === 0) { alert("El carrito está vacío."); return; }

    const orderTotal = waClientCart.reduce((sum, item) => sum + item.total, 0);
    
    const newIncomingOrder = {
      id: `WAPP-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
      date: new Date().toLocaleTimeString(),
      clientName: waClientName,
      items: [...waClientCart],
      total: orderTotal,
      status: 'pending'
    };
    
    setWaOrders([newIncomingOrder, ...waOrders]);

    let messageText = `Hola, soy ${waClientName}. Quiero hacer el siguiente pedido:\n\n`;
    waClientCart.forEach(item => {
      messageText += `- ${item.qty}x ${item.name} ($${item.total.toFixed(2)})\n`;
    });
    messageText += `\n*TOTAL A PAGAR: $${orderTotal.toFixed(2)}*`;
    
    const encodedMessage = encodeURIComponent(messageText);
    const waUrl = `https://wa.me/${waNumber}?text=${encodedMessage}`;
    
    setWaClientCart([]);
    setWaClientName('');
    alert("¡Pedido enviado! Se abrirá WhatsApp...");
    window.open(waUrl, '_blank');
  }

  const handleCompleteWaOrder = async (orderId) => {
    const orderIndex = waOrders.findIndex(o => o.id === orderId);
    const order = waOrders[orderIndex];
    
    let updatedInventory = [...inventory];
    let canFulfill = true;

    order.items.forEach(cartItem => {
      const invIndex = updatedInventory.findIndex(i => i.sku === cartItem.sku);
      if (invIndex >= 0 && updatedInventory[invIndex].stock >= cartItem.qty) {
        updatedInventory[invIndex].stock -= cartItem.qty;
      } else {
        canFulfill = false;
      }
    });

    if (!canFulfill) {
      alert("No hay stock físico suficiente para uno o más artículos de este pedido. Actualiza tu inventario o rechaza el pedido.");
      return;
    }

    const cartTotalCost = order.items.reduce((sum, item) => sum + (item.costPrice * item.qty), 0);
    const saleProfit = order.total - cartTotalCost;

    const newTicket = {
      id: order.id,
      date: new Date().toISOString(),
      displayDate: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString(),
      items: [...order.items],
      subtotal: order.total,
      commission: 0,
      total: order.total,
      profit: saleProfit,
      method: 'efectivo', 
      cashGiven: order.total,
      change: 0
    };

    try {
      const res = await fetch('http://localhost:5000/api/sales', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newTicket)
      });

      if (res.ok) {
        setSalesHistory([newTicket, ...salesHistory]);
        setInventory(updatedInventory);
        const newWaOrders = waOrders.filter(o => o.id !== orderId);
        setWaOrders(newWaOrders);
        alert(`¡Pedido ${order.id} completado con éxito! Inventario actualizado y venta registrada.`);
      }
    } catch { alert("Error al registrar venta en el servidor."); }
  }

  const handleRejectWaOrder = (orderId) => {
    const newWaOrders = waOrders.filter(o => o.id !== orderId);
    setWaOrders(newWaOrders);
  }

  const notificationBadgeStyle = {
    position: 'absolute', top: '-10px', right: '-10px', backgroundColor: '#ef4444', 
    color: 'white', borderRadius: '50%', width: '30px', height: '30px', 
    display: 'flex', alignItems: 'center', justifyContent: 'center', 
    fontWeight: 'bold', fontSize: '0.9rem', boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
  };


  // --------------------------------------------------------
  // PANTALLAS DE LOGIN Y DASHBOARD
  // --------------------------------------------------------
  if (!isLoggedIn) {
    if (!isSetupComplete) {
      return (
        <div className="login-container" style={themeStyles}>
          <div className="login-card">
             <div className="brand-panel">
               <h1>BIENVENIDO A<br/>{appName}</h1><p className="slogan">CONFIGURACIÓN INICIAL</p>
               <p style={{marginTop: '2rem'}}>Al parecer es la primera vez que abres el sistema. Registra al Administrador Principal para comenzar.</p>
             </div>
             <div className="login-panel">
               <h2>Crear Administrador</h2>
               <form onSubmit={handleCreateUser}>
                 <div className="input-group"><label>Nombre Real</label><input type="text" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} required/></div>
                 <div className="input-group"><label>Nombre de Usuario</label><input type="text" value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} required/></div>
                 <div className="input-group"><label>Contraseña Maestra</label><input type="password" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} required/></div>
                 <button type="submit" className="btn-primary full-width" style={{marginTop: '1rem'}}>Crear y Continuar</button>
               </form>
             </div>
          </div>
        </div>
      )
    }

    return (
      <div className="login-container" style={themeStyles}>
        <div className="login-card">
          <div className="brand-panel">
            <h1>POS VENTA<br/>{appName}</h1><p className="slogan">FÁCIL, RÁPIDO Y ORDENADO</p>
            <div className="company-info"><h3>Nuestra Misión</h3><p>Es brindar a nuestros usuarios el orden para sus negocios.</p><h3>Nuestra Visión</h3><p>Es llegar y facilitar el negocio de los usuarios de una tiendita.</p></div>
          </div>
          <div className="login-panel">
            <h2>Acceso al Sistema</h2>
            <form onSubmit={handleLoginSubmit}>
              <div className="input-group"><label>Usuario / Correo</label><input type="text" placeholder="Ingresa tu usuario" value={loginData.username} onChange={e => setLoginData({...loginData, username: e.target.value})} required /></div>
              <div className="input-group"><label>Contraseña</label><input type="password" placeholder="••••••••" value={loginData.password} onChange={e => setLoginData({...loginData, password: e.target.value})} required /></div>
              <div className="action-buttons">
                <button type="submit" className="btn-primary">Ingresar</button>
                <button type="button" className="btn-secondary">Registrarte</button>
              </div>
            </form>
            <button className="btn-text" style={{marginTop: '1rem', background: 'none', border: 'none', color: 'var(--accent-color)', cursor: 'pointer', textDecoration: 'underline'}}>¿Has olvidado tu contraseña?</button>
          </div>
        </div>
      </div>
    )
  }

  if (isLoggedIn && activeView === 'dashboard') {
    return (
      <div className="dashboard-container" style={themeStyles}>
        <header className="header">
          <h1>Panel de Control - {appName}</h1>
          <div style={{display:'flex', alignItems:'center', gap:'1rem'}}>
            <span>👤 Hola, <strong>{currentUser?.name}</strong></span>
            <button className="logout-btn" onClick={handleLogout}>Cerrar Sesión</button>
          </div>
        </header>
        <main className="dashboard-content">
          <h2 className="dashboard-title">Selecciona un módulo</h2>
          <div className="grid-menu">
            {currentUser?.permissions?.usuarios && <div className="module-card" onClick={() => setActiveView('usuarios')}><div className="icon">👥</div><h3>1. Usuarios</h3><p>Administrador y empleados</p></div>}
            {currentUser?.permissions?.configuracion && <div className="module-card" onClick={() => setActiveView('configuracion')}><div className="icon">🎨</div><h3>2. Editar Interfaz / BD</h3><p>Configuración y Base de Datos</p></div>}
            {currentUser?.permissions?.compras && <div className="module-card" onClick={() => setActiveView('proveedores')}><div className="icon">🚚</div><h3>3. Proveedores</h3><p>Alta y baja de surtidores</p></div>}
            {currentUser?.permissions?.compras && <div className="module-card" onClick={() => setActiveView('tickets')}><div className="icon">🧾</div><h3>4. Registro Contable</h3><p>Control de tickets de proveedores</p></div>}
            {currentUser?.permissions?.inventario && <div className="module-card" onClick={() => setActiveView('inventario')}><div className="icon">📦</div><h3>5. Registro Productos</h3><p>Categorías, ingresos y caducidad</p></div>}
            {currentUser?.permissions?.ventas && <div className="module-card highlight" onClick={() => setActiveView('ventas')} style={{borderColor: 'var(--accent-color)', borderWidth: '2px'}}><div className="icon">💰</div><h3>6. Punto de Venta</h3><p>Calculadora, escáner y cobro</p></div>}
            {currentUser?.permissions?.reportes && <div className="module-card" onClick={() => setActiveView('reportes')}><div className="icon">📊</div><h3>7. Reportes</h3><p>Cortes diarios, semanales y mensuales</p></div>}
            {currentUser?.permissions?.ventas && (
              <div className="module-card whatsapp" onClick={() => setActiveView('whatsapp')} style={{position: 'relative', border: waOrders.length > 0 ? '2px solid #22c55e' : ''}}>
                {waOrders.length > 0 && <div style={notificationBadgeStyle}>{waOrders.length}</div>}
                <div className="icon">📱</div><h3>8. Pedidos WhatsApp</h3><p>Notificaciones y carrito en línea</p>
              </div>
            )}
            {currentUser?.permissions?.inventario && <div className="module-card" onClick={() => setActiveView('control_inventario')}><div className="icon">📋</div><h3>9. Control Inventario</h3><p>Ajustes físicos, mermas y kardex</p></div>}
          </div>
        </main>
      </div>
    )
  }

  // --------------------------------------------------------
  // MÓDULO 1: USUARIOS
  // --------------------------------------------------------
  if (isLoggedIn && activeView === 'usuarios') {
    return (
      <div className="pos-container" style={themeStyles}>
        <header className="header">
          <button className="back-btn" onClick={() => setActiveView('dashboard')}>⬅ Volver al Menú</button>
          <h1>Gestión de Usuarios y Permisos</h1>
          <button className="logout-btn" onClick={handleLogout}>Cerrar Sesión</button>
        </header>
        <main className="main-content" style={{gap: '2rem'}}>
          
          {currentUser?.role === 'Administrador' ? (
            <section className="form-section" style={{flex: 1}}>
              <h2>Registrar Nuevo Empleado</h2>
              <form className="custom-form" onSubmit={handleCreateUser}>
                <div className="input-group"><label>Nombre Completo</label><input type="text" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} required/></div>
                <div className="input-group"><label>Usuario</label><input type="text" value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} required/></div>
                <div className="input-group"><label>Contraseña</label><input type="password" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} required/></div>
                <div className="input-group"><label>Rol Inicial</label><select className="role-select" value={newUser.role} onChange={handleRoleChange}><option value="Administrador">Administrador</option><option value="Vendedor">Vendedor</option><option value="Cajero">Cajero</option></select></div>
                <div style={{marginTop: '1.5rem', background: '#f8fafc', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border-color)'}}>
                  <h3 style={{fontSize: '0.9rem', color: 'var(--primary-color)', marginBottom: '1rem', textTransform: 'uppercase'}}>Permisos y Accesos Habilitados</h3>
                  <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
                    <label style={{display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', cursor: 'pointer'}}><input type="checkbox" checked={newUser.permissions.ventas} onChange={() => handlePermissionChange('ventas')} /> 💰 Punto de Venta</label>
                    <label style={{display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', cursor: 'pointer'}}><input type="checkbox" checked={newUser.permissions.inventario} onChange={() => handlePermissionChange('inventario')} /> 📦 Inventario</label>
                    <label style={{display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', cursor: 'pointer'}}><input type="checkbox" checked={newUser.permissions.reportes} onChange={() => handlePermissionChange('reportes')} /> 📊 Reportes</label>
                    <label style={{display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', cursor: 'pointer'}}><input type="checkbox" checked={newUser.permissions.compras} onChange={() => handlePermissionChange('compras')} /> 🧾 Compras / Prov.</label>
                    <label style={{display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', cursor: 'pointer'}}><input type="checkbox" checked={newUser.permissions.usuarios} onChange={() => handlePermissionChange('usuarios')} /> 👥 Usuarios</label>
                    <label style={{display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', cursor: 'pointer'}}><input type="checkbox" checked={newUser.permissions.configuracion} onChange={() => handlePermissionChange('configuracion')} /> 🎨 Configuración</label>
                  </div>
                </div>
                <button type="submit" className="btn-primary full-width" style={{marginTop: '1.5rem'}}>Guardar Usuario</button>
              </form>
            </section>
          ) : (
            <section className="form-section" style={{flex: 1, display:'flex', alignItems:'center', justifyContent:'center'}}>
              <h2 style={{color:'#64748b', textAlign: 'center'}}>🔒 Solo un Administrador puede registrar nuevos usuarios.</h2>
            </section>
          )}

          <aside className="list-section" style={{flex: 1}}>
            <h2>Directorio del Personal</h2>
            <div className="user-list" style={{display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.5rem'}}>
              {users.map(user => (
                <div key={user.id} style={{background: 'white', padding: '1rem', borderRadius: '8px', border: `1px solid ${user.role === 'Administrador' ? 'var(--accent-color)' : 'var(--border-color)'}`, display: 'flex', alignItems: 'center', gap: '1rem', boxShadow: 'var(--shadow-sm)'}}>
                  <div style={{fontSize: '2.5rem', background: '#f1f5f9', borderRadius: '50%', padding: '0.5rem', width: '60px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>{user.role === 'Administrador' ? '👑' : '👤'}</div>
                  <div style={{flex: 1}}>
                    <h4 style={{color: 'var(--primary-color)', fontSize: '1.1rem'}}>{user.name}</h4>
                    <p style={{fontSize: '0.9rem', color: '#64748b'}}>@{user.username} | <strong style={{color: user.role === 'Administrador' ? 'var(--accent-color)' : 'inherit'}}>{user.role}</strong></p>
                  </div>
                  {currentUser?.role === 'Administrador' && user.id !== currentUser.id && (
                    <button className="btn-icon delete" onClick={() => handleDeleteUser(user.id)}>🗑️</button>
                  )}
                </div>
              ))}
            </div>
          </aside>
        </main>
      </div>
    )
  }

  // --------------------------------------------------------
  // MÓDULO 5: INVENTARIO (CON IMÁGENES)
  // --------------------------------------------------------
  if (isLoggedIn && activeView === 'inventario') {
    return (
      <div className="pos-container" style={themeStyles}>
        <header className="header">
          <button className="back-btn" onClick={() => setActiveView('dashboard')}>⬅ Volver al Menú</button>
          <h1>Registro de Productos</h1>
          <button className="logout-btn" onClick={handleLogout}>Cerrar Sesión</button>
        </header>

        <main className="main-content" style={{flexDirection: 'column', alignItems: 'center', overflowY: 'auto'}}>
          
          <div className="module-tabs">
            <button className={`tab-btn ${inventoryTab === 'catalogo' ? 'active' : ''}`} onClick={() => setInventoryTab('catalogo')}>📋 Todos los Productos</button>
            <button className={`tab-btn ${inventoryTab === 'clasificacion' ? 'active' : ''}`} onClick={() => setInventoryTab('clasificacion')}>🏷️ Alta y Modificación</button>
            <button className={`tab-btn ${inventoryTab === 'existencias' ? 'active' : ''}`} onClick={() => setInventoryTab('existencias')}>📦 Reporte de Valor</button>
          </div>

          {inventoryTab === 'catalogo' && (
            <div style={{width: '100%', maxWidth: '1200px', display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem'}}>
              <div className="list-section" style={{flex: 'none', height: 'auto'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem'}}>
                  <h2>Catálogo Global de Productos</h2>
                  <input type="text" placeholder="🔍 Buscar por nombre o SKU..." value={catalogSearch} onChange={e => setCatalogSearch(e.target.value)} style={{minWidth: '300px'}}/>
                </div>
                
                <div className="table-container">
                  {filteredCatalog.length === 0 ? (
                    <p style={{textAlign: 'center', color: '#64748b', padding: '2rem'}}>No se encontraron productos.</p>
                  ) : (
                    <table className="data-table">
                      <thead><tr><th>Img</th><th>SKU</th><th>Nombre del Producto</th><th>Categoría</th><th>Costo</th><th>Precio Venta</th><th>Stock Actual</th><th>Acciones</th></tr></thead>
                      <tbody>
                        {filteredCatalog.map((prod, index) => (
                          <tr key={index}>
                            <td>{prod.image ? <img src={prod.image} alt={prod.name} style={{width:'40px', height:'40px', objectFit:'cover', borderRadius:'4px', border: '1px solid #ccc'}}/> : <span style={{fontSize:'1.5rem'}}>📦</span>}</td>
                            <td style={{fontSize: '0.85rem', color: '#64748b'}}>{prod.sku}</td>
                            <td><strong>{prod.name}</strong></td>
                            <td>{prod.category}</td>
                            <td style={{color: '#64748b'}}>${prod.costPrice.toFixed(2)}</td>
                            <td style={{fontWeight: 'bold', color: 'var(--accent-color)'}}>${prod.salePrice.toFixed(2)}</td>
                            <td><span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: prod.stock <= 5 ? '#ef4444' : '#10b981' }}>{prod.stock}</span></td>
                            <td><button className="btn-icon" onClick={() => handleEditClick(prod)}>✏️ Editar</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}

          {inventoryTab === 'clasificacion' && (
            <div style={{display: 'flex', width: '100%', maxWidth: '1200px', gap: '1.5rem', marginBottom: '2rem'}}>
              <section className="form-section" style={{flex: 1, margin: '0 auto', maxWidth: '600px'}}>
                <h2>Gestión de Información</h2>
                
                {formMode === 'idle' && (
                  <div style={{marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem'}}>
                    <div className="scan-box" style={{padding: '1rem', borderStyle: 'solid'}}>
                      <p style={{marginBottom: '1rem'}}>Elige una acción o usa el Catálogo para editar un producto existente.</p>
                      <button className="btn-primary full-width" onClick={() => setFormMode('newProduct')}>➕ Alta Manual de Producto</button>
                      <button className="btn-secondary full-width" onClick={() => setFormMode('newCategory')} style={{marginTop: '0.5rem'}}>🏷️ Crear Nueva Categoría</button>
                    </div>
                  </div>
                )}

                {formMode === 'newCategory' && (
                  <form className="custom-form" onSubmit={handleAddNewCategory} style={{marginTop: '1rem'}}>
                    <h3 style={{fontSize: '1.1rem', color: 'var(--accent-color)', marginBottom: '1rem'}}>Crear Categoría</h3>
                    <div className="input-group"><label>Nombre de la Categoría</label><input type="text" placeholder="Ej. Ferretería, Botanas..." value={newCatName} onChange={e => setNewCatName(e.target.value)} required /></div>
                    <div className="action-buttons"><button type="submit" className="btn-primary">Guardar Categoría</button><button type="button" className="btn-secondary" onClick={() => setFormMode('idle')}>Cancelar</button></div>
                  </form>
                )}

                {formMode === 'newProduct' && (
                  <form className="custom-form" onSubmit={handleSaveNewManualProduct} style={{marginTop: '1rem'}}>
                    <h3 style={{fontSize: '1.1rem', color: 'var(--accent-color)', marginBottom: '1rem'}}>Nuevo Producto</h3>
                    
                    <div className="input-group" style={{alignItems: 'center', background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px dashed var(--border-color)'}}>
                      <label style={{width: '100%', textAlign: 'left'}}>Foto del Producto (Opcional)</label>
                      {newManualProduct.image ? (
                         <img src={newManualProduct.image} alt="Preview" style={{width: '100px', height: '100px', objectFit: 'cover', borderRadius: '8px', marginBottom: '1rem'}} />
                      ) : (
                         <div style={{fontSize: '3rem', color: '#cbd5e1', marginBottom: '1rem'}}>📷</div>
                      )}
                      <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, setNewManualProduct, newManualProduct)} style={{width: '100%', fontSize: '0.85rem'}} />
                    </div>

                    <div className="input-group"><label>SKU / Código de Barras</label><input type="text" value={newManualProduct.sku} onChange={e => setNewManualProduct({...newManualProduct, sku: e.target.value})} required/></div>
                    <div className="input-group"><label>Nombre del Producto</label><input type="text" value={newManualProduct.name} onChange={e => setNewManualProduct({...newManualProduct, name: e.target.value})} required/></div>
                    <div className="input-row">
                      <div className="input-group"><label>Categoría</label><select className="role-select" value={newManualProduct.category} onChange={e => setNewManualProduct({...newManualProduct, category: e.target.value})}><option value="Por clasificar">Selecciona...</option>{categories.map((cat, i) => <option key={i} value={cat}>{cat}</option>)}</select></div>
                      <div className="input-group"><label>Stock Inicial</label><input type="number" min="0" value={newManualProduct.stock} onChange={e => setNewManualProduct({...newManualProduct, stock: e.target.value})} /></div>
                    </div>
                    <div className="input-row">
                      <div className="input-group"><label>Costo (Tú pagas)</label><input type="number" step="0.01" value={newManualProduct.costPrice} onChange={e => setNewManualProduct({...newManualProduct, costPrice: e.target.value})} /></div>
                      <div className="input-group"><label>Venta (Público)</label><input type="number" step="0.01" value={newManualProduct.salePrice} onChange={e => setNewManualProduct({...newManualProduct, salePrice: e.target.value})} /></div>
                    </div>
                    {(newManualProduct.category === 'Lácteos' || newManualProduct.category === 'Carnes') && (
                      <div className="input-group" style={{background: '#fffbeb', padding: '1rem', borderRadius: '8px', border: '1px solid #fde68a'}}><label style={{color: '#b45309'}}>Fecha de Caducidad</label><input type="date" value={newManualProduct.expiry} onChange={e => setNewManualProduct({...newManualProduct, expiry: e.target.value})} required/></div>
                    )}
                    <div className="action-buttons"><button type="submit" className="btn-primary">Guardar Producto</button><button type="button" className="btn-secondary" onClick={() => setFormMode('idle')}>Cancelar</button></div>
                  </form>
                )}

                {formMode === 'edit' && editForm && (
                  <form className="custom-form" onSubmit={handleSaveProductEdit} style={{marginTop: '1rem'}}>
                    <h3 style={{fontSize: '1.1rem', color: 'var(--accent-color)', marginBottom: '1rem'}}>Editando Producto</h3>

                    <div className="input-group" style={{alignItems: 'center', background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px dashed var(--border-color)'}}>
                      <label style={{width: '100%', textAlign: 'left'}}>Actualizar Foto</label>
                      {editForm.image ? (
                         <img src={editForm.image} alt="Preview" style={{width: '100px', height: '100px', objectFit: 'cover', borderRadius: '8px', marginBottom: '1rem'}} />
                      ) : (
                         <div style={{fontSize: '3rem', color: '#cbd5e1', marginBottom: '1rem'}}>📷</div>
                      )}
                      <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, setEditForm, editForm)} style={{width: '100%', fontSize: '0.85rem'}} />
                    </div>

                    <div className="input-group"><label>SKU / Código</label><input type="text" value={editForm.sku} disabled style={{backgroundColor: '#f1f5f9', cursor: 'not-allowed'}} /></div>
                    <div className="input-group"><label>Nombre del Producto</label><input type="text" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} /></div>
                    <div className="input-group"><label>Clasificación / Categoría</label><select className="role-select" value={editForm.category} onChange={e => setEditForm({...editForm, category: e.target.value})}><option value="Por clasificar">Selecciona...</option>{categories.map((cat, i) => <option key={i} value={cat}>{cat}</option>)}</select></div>
                    {(editForm.category === 'Lácteos' || editForm.category === 'Carnes') && (
                      <div className="input-group" style={{background: '#fffbeb', padding: '1rem', borderRadius: '8px', border: '1px solid #fde68a'}}><label style={{color: '#b45309'}}>Fecha de Caducidad</label><input type="date" value={editForm.expiry} onChange={e => setEditForm({...editForm, expiry: e.target.value})} required/></div>
                    )}
                    <div className="financial-inputs">
                      <div className="input-row">
                        <div className="input-group"><label>Precio Costo (Compra)</label><div className="auto-calc">${Number(editForm.costPrice).toFixed(2)}</div></div>
                        <div className="input-group"><label style={{color: 'var(--accent-color)', fontWeight: 'bold'}}>Precio Venta Público ($)</label><input type="number" step="0.01" value={editForm.salePrice} onChange={e => setEditForm({...editForm, salePrice: e.target.value})} style={{border: '2px solid var(--accent-color)'}}/></div>
                      </div>
                    </div>
                    <div className="action-buttons"><button type="submit" className="btn-primary">Guardar Cambios</button><button type="button" className="btn-secondary" onClick={() => setFormMode('idle')}>Cancelar</button></div>
                  </form>
                )}
              </section>
            </div>
          )}

          {inventoryTab === 'existencias' && (
            <div style={{width: '100%', maxWidth: '1200px', display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem'}}>
              <div className="summary-grid" style={{marginBottom: 0}}>
                <div className="summary-card"><h4>Total Artículos en Tienda</h4><div className="amount">{totalStockItems} <span style={{fontSize: '1rem', color: '#64748b'}}>pzas</span></div></div>
                <div className="summary-card"><h4>Inversión (Valor Costo)</h4><div className="amount" style={{color: '#ea580c'}}>${totalCostValue.toFixed(2)}</div></div>
                <div className="summary-card total"><h4>Valor de Venta (Ingreso Esperado)</h4><div className="amount">${totalSaleValue.toFixed(2)}</div><div style={{fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)', marginTop: '0.5rem'}}>Ganancia proyectada: ${expectedProfit.toFixed(2)}</div></div>
              </div>
              <div className="list-section" style={{flex: 'none', height: 'auto'}}>
                <h2>Control de Caducidades y Valor Unitario</h2>
                <div className="table-container">
                  <table className="data-table">
                    <thead><tr><th>SKU</th><th>Producto</th><th>Stock Actual</th><th>Valor Inv. (Costo)</th><th>Estado de Caducidad</th></tr></thead>
                    <tbody>
                      {inventory.map((prod, index) => {
                        const expiryInfo = checkExpiryStatus(prod.expiry);
                        return (
                          <tr key={index}>
                            <td style={{fontSize: '0.85rem', color: '#64748b'}}>{prod.sku}</td>
                            <td><strong>{prod.name}</strong><br/><small style={{color: '#64748b'}}>{prod.category}</small></td>
                            <td><span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: prod.stock <= 5 ? '#ef4444' : '#10b981' }}>{prod.stock}</span></td>
                            <td>${(prod.stock * prod.costPrice).toFixed(2)}</td>
                            <td><span className={`status-badge ${expiryInfo.status}`}>{expiryInfo.text} {prod.expiry && `(${prod.expiry})`}</span></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    )
  }

  // --------------------------------------------------------
  // MÓDULO 6: PUNTO DE VENTA
  // --------------------------------------------------------
  if (isLoggedIn && activeView === 'ventas') {
    return (
      <div className="pos-container" style={themeStyles}>
        {/* MODAL DE COBRO */}
        {checkoutModal && (
          <div className="modal-overlay" onClick={() => setCheckoutModal(false)}>
            <div className="modal-content" style={{background: 'white', padding: '2rem', borderRadius: '12px', width: '100%', maxWidth: '400px'}} onClick={e => e.stopPropagation()}>
              <h2 style={{marginBottom: '1rem', color: 'var(--primary-color)'}}>Procesar Pago</h2>
              <h1 style={{fontSize: '2.5rem', textAlign: 'center', marginBottom: '1.5rem', color: 'var(--accent-color)'}}>${cartTotalFinal.toFixed(2)}</h1>
              
              <form onSubmit={handleProcessSale} className="custom-form">
                <div className="input-group">
                  <label>Método de Pago</label>
                  <select value={paymentData.method} onChange={e => setPaymentData({...paymentData, method: e.target.value})}>
                    <option value="efectivo">💵 Efectivo</option>
                    <option value="tarjeta">💳 Tarjeta (Crédito/Débito)</option>
                    <option value="transferencia">🏦 Transferencia (SPEI)</option>
                  </select>
                </div>

                {paymentData.method === 'tarjeta' && (
                  <div className="input-group" style={{background: '#eff6ff', padding: '1rem', borderRadius: '8px'}}>
                    <label>Comisión Bancaria (%)</label>
                    <input type="number" step="0.1" min="0" value={paymentData.cardCommissionPct} onChange={e => setPaymentData({...paymentData, cardCommissionPct: e.target.value})} />
                    <small style={{color: '#3b82f6', marginTop: '0.5rem'}}>Se sumarán ${commissionAmount.toFixed(2)} al cobro.</small>
                  </div>
                )}

                {paymentData.method === 'efectivo' && (
                  <div className="input-group">
                    <label>Efectivo Recibido ($)</label>
                    <input type="number" step="0.01" min={cartTotalFinal} value={paymentData.cashGiven} onChange={e => setPaymentData({...paymentData, cashGiven: e.target.value})} required autoFocus/>
                    <div style={{marginTop: '1rem', fontSize: '1.2rem', fontWeight: 'bold', color: changeToGive >= 0 ? '#10b981' : '#ef4444'}}>
                      Cambio a devolver: ${changeToGive >= 0 ? changeToGive.toFixed(2) : '0.00'}
                    </div>
                  </div>
                )}

                <div className="action-buttons">
                  <button type="submit" className="btn-primary full-width" style={{fontSize: '1.2rem'}}>💸 Confirmar Pago</button>
                  <button type="button" className="btn-secondary full-width" onClick={() => setCheckoutModal(false)}>Cancelar</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL DEL TICKET FINAL */}
        {saleTicket && (
          <div className="modal-overlay">
            <div className="modal-content receipt-style">
              <div className="receipt-header">
                <h2>{appName}</h2>
                <p>TICKET DE VENTA</p>
                <p>Folio: {saleTicket.id}</p>
                <p>{saleTicket.displayDate}</p>
              </div>
              <table className="receipt-table">
                <thead><tr><th style={{textAlign: 'left'}}>CANT</th><th style={{textAlign: 'left'}}>DESC</th><th style={{textAlign: 'right'}}>IMPORTE</th></tr></thead>
                <tbody>
                  {saleTicket.items.map((item, idx) => (
                    <tr key={idx}><td>{item.qty}</td><td>{item.name}</td><td style={{textAlign:'right'}}>${item.total.toFixed(2)}</td></tr>
                  ))}
                </tbody>
              </table>
              <div className="receipt-totals">
                {saleTicket.commission > 0 && <p>SUBTOTAL: <span>${saleTicket.subtotal.toFixed(2)}</span></p>}
                {saleTicket.commission > 0 && <p>COMISIÓN TDD/TDC: <span>${saleTicket.commission.toFixed(2)}</span></p>}
                <h3 style={{fontSize: '1.2rem', marginTop: '0.5rem'}}>TOTAL: <span>${saleTicket.total.toFixed(2)}</span></h3>
                <p style={{marginTop: '1rem', textTransform: 'uppercase'}}>PAGO CON: {saleTicket.method}</p>
                {saleTicket.method === 'efectivo' && (
                  <>
                    <p>RECIBIDO: <span>${saleTicket.cashGiven.toFixed(2)}</span></p>
                    <p>CAMBIO: <span>${saleTicket.change.toFixed(2)}</span></p>
                  </>
                )}
              </div>
              <div className="modal-actions" style={{marginTop: '2rem'}}>
                <button className="btn-primary" onClick={() => window.print()}>🖨️ Imprimir</button>
                <button className="btn-secondary" onClick={() => setSaleTicket(null)}>Nueva Venta</button>
              </div>
            </div>
          </div>
        )}

        <header className="header">
          <button className="back-btn" onClick={() => setActiveView('dashboard')}>⬅ Volver al Menú</button>
          <h1>Caja Registradora</h1>
          <button className="logout-btn" onClick={handleLogout}>Cerrar Sesión</button>
        </header>

        <main className="main-content" style={{gap: '2rem'}}>
          <section className="form-section" style={{flex: 2, display: 'flex', flexDirection: 'column'}}>
            <form onSubmit={handleSearchAndAddToCart} className="input-row" style={{marginBottom: '1.5rem'}}>
              <div className="input-group" style={{flex: 1, marginBottom: 0}}>
                <input type="text" placeholder="🔍 Escanea SKU o busca por nombre y presiona Enter..." value={searchSku} onChange={e => setSearchSku(e.target.value)} autoFocus style={{fontSize: '1.2rem', padding: '1rem'}} />
              </div>
              <button type="submit" className="btn-secondary" style={{height: '100%'}}>Agregar</button>
            </form>

            <h2>Acceso Rápido (Inventario Disponible)</h2>
            <div className="grid-menu" style={{marginTop: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))'}}>
              {inventory.filter(p => p.stock > 0).map((prod, idx) => (
                <div key={idx} className="module-card" onClick={() => addToCart(prod)} style={{padding: '1rem', alignItems: 'center', textAlign: 'center'}}>
                  <div style={{height: '80px', marginBottom: '0.5rem', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
                    {prod.image ? <img src={prod.image} alt={prod.name} style={{maxWidth:'100%', maxHeight:'100%', objectFit:'contain', borderRadius:'8px'}}/> : <span style={{fontSize: '2.5rem'}}>📦</span>}
                  </div>
                  <h4 style={{fontSize: '0.9rem', marginBottom: '0.5rem'}}>{prod.name}</h4>
                  <p style={{color: 'var(--accent-color)', fontWeight: 'bold'}}>${prod.salePrice.toFixed(2)}</p>
                  <small style={{color: '#64748b'}}>{prod.stock} disp.</small>
                </div>
              ))}
            </div>
          </section>

          <aside className="list-section" style={{flex: 1, display: 'flex', flexDirection: 'column', minHeight: '60vh'}}>
            <h2 style={{marginBottom: '1rem'}}>Cuenta Actual</h2>
            <div style={{flex: 1, overflowY: 'auto', borderBottom: '1px solid var(--border-color)', marginBottom: '1rem', paddingBottom: '1rem'}}>
              {cart.length === 0 ? (
                <p style={{textAlign: 'center', color: '#64748b', marginTop: '2rem'}}>El carrito está vacío</p>
              ) : (
                <table className="mini-table">
                  <thead><tr><th>Cant</th><th>Producto</th><th>Total</th><th></th></tr></thead>
                  <tbody>
                    {cart.map((item, idx) => (
                      <tr key={idx}>
                        <td>{item.qty}</td>
                        <td style={{fontSize: '0.85rem'}}>{item.name}</td>
                        <td style={{fontWeight: 'bold'}}>${item.total.toFixed(2)}</td>
                        <td><button className="btn-icon delete" onClick={() => removeFromCart(item.sku)}>✖</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="cart-total" style={{padding: '1rem', background: '#f8fafc', borderRadius: '8px', marginBottom: '1rem'}}>
              <h3 style={{display: 'flex', justifyContent: 'space-between', fontSize: '1.5rem'}}>
                Total: <span>${cartSubtotal.toFixed(2)}</span>
              </h3>
            </div>
            <button
              className="btn-primary full-width"
              style={{fontSize: '1.2rem', padding: '1rem'}}
              disabled={cart.length === 0}
              onClick={() => setCheckoutModal(true)}
            >
              💳 Procesar Cobro
            </button>
          </aside>
        </main>
      </div>
    )
  }

  // --------------------------------------------------------
  // MÓDULO 8: WHATSAPP STORE
  // --------------------------------------------------------
  if (isLoggedIn && activeView === 'whatsapp') {
    return (
      <div className="pos-container" style={themeStyles}>
        <header className="header">
          <button className="back-btn" onClick={() => setActiveView('dashboard')}>⬅ Volver al Menú</button>
          <h1>Gestión de Pedidos Online</h1>
          <button className="logout-btn" onClick={handleLogout}>Cerrar Sesión</button>
        </header>

        <main className="main-content" style={{flexDirection: 'column', alignItems: 'center', overflowY: 'auto'}}>
          
          <div className="module-tabs" style={{maxWidth: '800px', margin: '0 auto 2rem auto'}}>
            <button className={`tab-btn ${waTab === 'pedidos' ? 'active' : ''}`} onClick={() => setWaTab('pedidos')}>
              🔔 Pedidos Entrantes {waOrders.length > 0 && `(${waOrders.length})`}
            </button>
            <button className={`tab-btn ${waTab === 'simulador' ? 'active' : ''}`} onClick={() => setWaTab('simulador')}>
              📱 Simulador Tienda Cliente
            </button>
          </div>

          {waTab === 'pedidos' && (
            <div style={{width: '100%', maxWidth: '1000px', display: 'flex', flexDirection: 'column', gap: '1.5rem'}}>
              <div className="input-group" style={{maxWidth: '400px', background: '#f8fafc', padding: '1rem', borderRadius: '8px'}}>
                <label>Tu número de WhatsApp (Con código de país, ej. 525512345678)</label>
                <input type="text" value={waNumber} onChange={e => setWaNumber(e.target.value)} />
              </div>

              <h2>Bandeja de Entrada</h2>
              {waOrders.length === 0 ? (
                <div style={{textAlign: 'center', padding: '3rem', color: '#64748b', background: '#f8fafc', borderRadius: '12px'}}>
                  <span style={{fontSize: '3rem'}}>📭</span><br/>No hay pedidos nuevos.
                </div>
              ) : (
                <div style={{display: 'grid', gridTemplateColumns: '1fr', gap: '1rem'}}>
                  {waOrders.map((order) => (
                    <div key={order.id} style={{background: 'white', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem'}}>
                      <div>
                        <h3 style={{color: 'var(--primary-color)'}}>{order.clientName} <span style={{fontSize: '0.85rem', color: '#64748b', fontWeight: 'normal'}}>• {order.date}</span></h3>
                        <p style={{margin: '0.5rem 0', fontSize: '0.9rem', color: '#64748b'}}>{order.items.map(i => `${i.qty}x ${i.name}`).join(', ')}</p>
                        <h4 style={{color: '#10b981'}}>Total a Cobrar: ${order.total.toFixed(2)}</h4>
                      </div>
                      <div style={{display: 'flex', gap: '0.5rem'}}>
                        <button className="btn-secondary" style={{color: '#ef4444'}} onClick={() => handleRejectWaOrder(order.id)}>✖ Rechazar</button>
                        <button className="btn-primary" style={{background: '#10b981'}} onClick={() => handleCompleteWaOrder(order.id)}>✔️ Alistado y Cobrado</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {waTab === 'simulador' && (
            <div style={{display: 'flex', width: '100%', maxWidth: '1000px', gap: '2rem'}}>
              <section style={{flex: 2}}>
                <h2>Catálogo de {appName}</h2>
                <p style={{color: '#64748b', marginBottom: '1.5rem'}}>Así ve el cliente los productos con stock disponible.</p>
                <div className="grid-menu" style={{gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))'}}>
                  {inventory.filter(p => p.stock > 0).map((prod, idx) => (
                    <div key={idx} className="module-card" onClick={() => addToWaCart(prod)} style={{padding: '1rem', alignItems: 'center', textAlign: 'center'}}>
                      <div style={{height: '80px', marginBottom: '0.5rem', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
                        {prod.image ? <img src={prod.image} alt={prod.name} style={{maxWidth:'100%', maxHeight:'100%', objectFit:'contain', borderRadius:'8px'}}/> : <span style={{fontSize: '2.5rem'}}>🛒</span>}
                      </div>
                      <h4 style={{fontSize: '0.9rem', marginBottom: '0.5rem'}}>{prod.name}</h4>
                      <p style={{color: '#10b981', fontWeight: 'bold'}}>${prod.salePrice.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </section>

              <aside className="list-section" style={{flex: 1, minWidth: '300px', background: '#dcf8c6', border: '1px solid #25d366'}}>
                <h2 style={{color: '#075e54', marginBottom: '1rem'}}>Mi Pedido</h2>
                <div className="input-group">
                  <input type="text" placeholder="Tu Nombre Completo" value={waClientName} onChange={e => setWaClientName(e.target.value)} style={{border: '1px solid #25d366'}}/>
                </div>
                
                <div style={{minHeight: '200px', borderTop: '1px solid #25d366', paddingTop: '1rem', marginBottom: '1rem'}}>
                  {waClientCart.length === 0 ? (
                    <p style={{textAlign: 'center', color: '#075e54', marginTop: '2rem'}}>Aún no has agregado productos.</p>
                  ) : (
                    waClientCart.map((item, idx) => (
                      <div key={idx} style={{display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#075e54'}}>
                        <span>{item.qty}x {item.name}</span>
                        <strong>${item.total.toFixed(2)}</strong>
                      </div>
                    ))
                  )}
                </div>
                
                <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', fontWeight: 'bold', color: '#075e54', borderTop: '2px dashed #25d366', paddingTop: '1rem', marginBottom: '1rem'}}>
                  <span>Total:</span>
                  <span>${waClientCart.reduce((s, i) => s + i.total, 0).toFixed(2)}</span>
                </div>

                <button className="btn-primary full-width" style={{background: '#25d366', fontSize: '1.1rem'}} onClick={handleSendWaOrder} disabled={waClientCart.length === 0}>
                  Enviar Pedido WhatsApp
                </button>
              </aside>
            </div>
          )}
        </main>
      </div>
    )
  }

  // --------------------------------------------------------
  // MÓDULO 2 Y BASE DE DATOS (CONFIGURACIÓN)
  // --------------------------------------------------------
  if (isLoggedIn && activeView === 'configuracion') {
    return (
      <div className="pos-container" style={themeStyles}>
        <header className="header">
          <button className="back-btn" onClick={() => setActiveView('dashboard')}>⬅ Volver al Menú</button>
          <h1>Configuración del Sistema</h1>
          <button className="logout-btn" onClick={handleLogout}>Cerrar Sesión</button>
        </header>
        
        <main className="main-content" style={{flexDirection: 'column'}}>
          <div style={{display: 'flex', gap: '2rem', width: '100%', flexWrap: 'wrap'}}>
            <section className="form-section" style={{flex: 1, minWidth: '300px'}}>
              <h2>Ajustes de Apariencia</h2>
              <form className="custom-form" onSubmit={handleSaveSettings}>
                <div className="settings-block">
                  <div className="input-group"><label>Título del Panel</label><input type="text" value={tempAppName} onChange={(e) => setTempAppName(e.target.value)} /></div>
                </div>
                <div className="settings-block">
                  <div className="color-pickers">
                    <div className="color-group"><label>Principal</label><input type="color" value={tempPrimaryColor} onChange={(e) => setTempPrimaryColor(e.target.value)} /></div>
                    <div className="color-group"><label>Acento</label><input type="color" value={tempAccentColor} onChange={(e) => setTempAccentColor(e.target.value)} /></div>
                  </div>
                </div>
                <button type="submit" className="btn-primary full-width">Aplicar Cambios</button>
              </form>
            </section>
            
            <aside className="preview-section" style={{flex: 1, minWidth: '300px'}}>
              <h2>Vista Previa</h2>
              <div className="mockup-screen" style={{border: '1px solid #ccc', height: '200px', borderRadius: '8px', overflow: 'hidden'}}>
                <div className="mockup-header" style={{backgroundColor: tempPrimaryColor, color: 'white', padding: '1rem'}}>
                  <span>Panel - {tempAppName}</span>
                </div>
              </div>
            </aside>
          </div>

          {/* ZONA DE PELIGRO - GESTIÓN DE DB ACTUALIZADA */}
          {currentUser?.role === 'Administrador' && (
            <section className="form-section" style={{border: '2px solid #ef4444', backgroundColor: '#fff', width: '100%', marginTop: '2rem' }}>
              <h2 style={{color: '#ef4444', textAlign: 'center'}}>⚠️ Zona de Peligro: Gestión de Base de Datos</h2>
              <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '1.5rem'}}>
                <button className="btn-primary" style={{background: '#3b82f6'}} onClick={handleDbInitialize}>🔄 Iniciar / Cargar DB</button>
                <button className="btn-primary" style={{background: '#ef4444'}} onClick={handleDbClear}>🗑️ Limpiar DB Local</button>
                <button className="btn-primary" style={{background: '#10b981'}} onClick={handleDbSave}>💾 Guardar DB en Servidor</button>
              </div>
              <button className="btn-secondary full-width" style={{marginTop: '1rem'}} onClick={() => window.open('http://localhost:5000/api/db/backup')}>📥 Descargar Respaldo Físico (.db)</button>
            </section>
          )}

        </main>
      </div>
    )
  }

  // --------------------------------------------------------
  // MÓDULOS RESTANTES (Reportes, Proveedores, Tickets, etc)
  // --------------------------------------------------------
  if (isLoggedIn && activeView === 'reportes') {
    return (
      <div className="pos-container" style={themeStyles}>
        <header className="header"><button className="back-btn" onClick={() => setActiveView('dashboard')}>⬅ Volver al Menú</button><h1>Reportes Financieros</h1><button className="logout-btn" onClick={handleLogout}>Cerrar Sesión</button></header>
        <main className="main-content" style={{flexDirection: 'column', alignItems: 'center', overflowY: 'auto'}}>
          <div className="module-tabs" style={{maxWidth: '1000px', margin: '0 auto 2rem auto', display: 'flex', gap: '1rem', alignItems: 'center', padding: '0.5rem 1rem'}}>
            <div style={{display: 'flex', flex: 1, gap: '0.5rem'}}><button className={`tab-btn ${reportPeriod === 'hoy' ? 'active' : ''}`} onClick={() => setReportPeriod('hoy')}>📅 Hoy</button><button className={`tab-btn ${reportPeriod === 'semana' ? 'active' : ''}`} onClick={() => setReportPeriod('semana')}>📅 Semana</button><button className={`tab-btn ${reportPeriod === 'mes' ? 'active' : ''}`} onClick={() => setReportPeriod('mes')}>📅 Mes</button><button className={`tab-btn ${reportPeriod === 'anio' ? 'active' : ''}`} onClick={() => setReportPeriod('anio')}>📅 Año</button></div>
            <button className="btn-primary" onClick={handleExportExcel} style={{background: '#10b981', marginLeft: '1rem'}}>📥 Descargar Excel (CSV)</button>
          </div>
          <div style={{display: 'flex', width: '100%', maxWidth: '1200px', gap: '2rem', flexWrap: 'wrap'}}>
            <div style={{flex: 2, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', alignContent: 'start'}}>
              <div className="summary-card" style={{borderLeftColor: '#10b981'}}><h4 style={{color: '#64748b'}}>Ingresos por Ventas</h4><div className="amount" style={{color: '#10b981'}}>${reportTotalVentas.toFixed(2)}</div><div style={{fontSize: '0.85rem', marginTop: '0.5rem'}}>Tickets emitidos: {filteredSales.length}</div></div>
              <div className="summary-card" style={{borderLeftColor: '#f59e0b'}}><h4 style={{color: '#64748b'}}>Gasto en Compras</h4><div className="amount" style={{color: '#f59e0b'}}>${reportTotalCompras.toFixed(2)}</div><div style={{fontSize: '0.85rem', marginTop: '0.5rem'}}>Tickets recibidos: {filteredPurchases.length}</div></div>
              <div className="summary-card" style={{borderLeftColor: '#ef4444'}}><h4 style={{color: '#64748b'}}>Pérdidas (Mermas/Daños)</h4><div className="amount" style={{color: '#ef4444'}}>${reportTotalPerdidas.toFixed(2)}</div><div style={{fontSize: '0.85rem', marginTop: '0.5rem'}}>Basado en costo de compra</div></div>
              <div className="summary-card total" style={{gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}><div><h4 style={{color: 'rgba(255,255,255,0.8)'}}>Ganancia Neta Libre (Utilidad)</h4><div className="amount" style={{fontSize: '2.5rem'}}>${reportTotalGanancias.toFixed(2)}</div><div style={{fontSize: '0.9rem', marginTop: '0.5rem'}}>(Ventas brutas - Costo de productos vendidos)</div></div><div style={{fontSize: '4rem'}}>💰</div></div>
            </div>
            <aside className="list-section" style={{flex: 1, minWidth: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
              <h2 style={{marginBottom: '2rem', textAlign: 'center'}}>Distribución del Capital</h2>
              {totalEgresosIngresos <= 1 ? (<div style={{padding: '3rem 0', color: '#64748b'}}>No hay datos para graficar en este periodo.</div>) : (<><div style={pieChartStyle}></div><div style={{width: '100%', marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem'}}><div style={{display: 'flex', justifyContent: 'space-between'}}><span><span style={{color: '#10b981', fontWeight: 'bold'}}>■</span> Ventas</span><strong>{((reportTotalVentas / totalEgresosIngresos) * 100).toFixed(1)}%</strong></div><div style={{display: 'flex', justifyContent: 'space-between'}}><span><span style={{color: '#f59e0b', fontWeight: 'bold'}}>■</span> Compras (Gasto)</span><strong>{((reportTotalCompras / totalEgresosIngresos) * 100).toFixed(1)}%</strong></div><div style={{display: 'flex', justifyContent: 'space-between'}}><span><span style={{color: '#ef4444', fontWeight: 'bold'}}>■</span> Pérdidas / Mermas</span><strong>{((reportTotalPerdidas / totalEgresosIngresos) * 100).toFixed(1)}%</strong></div></div></>)}
            </aside>
          </div>
        </main>
      </div>
    )
  }

  if (isLoggedIn && activeView === 'proveedores') {
    return (
      <div className="pos-container" style={themeStyles}>
        <header className="header"><button className="back-btn" onClick={() => setActiveView('dashboard')}>⬅ Volver al Menú</button><h1>Directorio de Proveedores</h1><button className="logout-btn" onClick={handleLogout}>Cerrar Sesión</button></header>
        <main className="main-content">
          <section className="form-section"><h2>Alta de Proveedor</h2><form className="custom-form" onSubmit={(e) => e.preventDefault()}><div className="input-group"><label>Empresa</label><input type="text" /></div><div className="input-group"><label>R.F.C.</label><input type="text" style={{ textTransform: 'uppercase' }} /></div><button className="btn-primary full-width">Guardar Proveedor</button></form></section>
          <aside className="list-section" style={{flex: 2}}><h2>Proveedores Registrados</h2><div className="table-container"><table className="data-table"><thead><tr><th>Empresa</th><th>RFC</th></tr></thead><tbody><tr><td>Coca-Cola FEMSA</td><td>KOF930408TK1</td></tr></tbody></table></div></aside>
        </main>
      </div>
    )
  }

  if (isLoggedIn && activeView === 'tickets') {
    return (
      <div className="pos-container" style={themeStyles}>
        {renderTicketModal()}
        <header className="header"><button className="back-btn" onClick={() => setActiveView('dashboard')}>⬅ Volver al Menú</button><h1>Registro Contable de Compras</h1><button className="logout-btn" onClick={handleLogout}>Cerrar Sesión</button></header>
        <main className="main-content" style={{flexDirection: 'column', alignItems: 'center', overflowY: 'auto'}}>
          <div className="module-tabs"><button className={`tab-btn ${ticketTab === 'captura' ? 'active' : ''}`} onClick={() => setTicketTab('captura')}>📝 Captura de Ticket</button><button className={`tab-btn ${ticketTab === 'historial' ? 'active' : ''}`} onClick={() => setTicketTab('historial')}>📊 Historial Completo</button></div>
          {ticketTab === 'captura' && (
            <section className="form-section" style={{width: '100%', maxWidth: '850px', flex: 'none', height: 'auto', marginBottom: '2rem'}}><h2>Captura de Ticket de Proveedor</h2><form className="custom-form" onSubmit={handleSaveTicket}><div className="input-row"><div className="input-group"><label>Proveedor</label><select className="role-select" value={ticketMeta.provider} onChange={e => setTicketMeta({...ticketMeta, provider: e.target.value})}><option value="">Selecciona...</option><option value="Comercializadora Bimbo">Comercializadora Bimbo</option><option value="Coca-Cola FEMSA">Coca-Cola FEMSA</option></select></div><div className="input-group"><label>Fecha del Ticket</label><input type="date" value={ticketMeta.date} onChange={e => setTicketMeta({...ticketMeta, date: e.target.value})} /></div></div><div className="ticket-item-adder"><h3 style={{fontSize: '1rem', marginBottom: '0.5rem', color: 'var(--accent-color)'}}>➕ Agregar Producto</h3><div className="input-row"><div className="input-group" style={{flex: 1}}><label>SKU</label><input type="text" value={newItem.sku} onChange={e => setNewItem({...newItem, sku: e.target.value})} /></div><div className="input-group" style={{flex: 2}}><label>Descripción</label><input type="text" value={newItem.desc} onChange={e => setNewItem({...newItem, desc: e.target.value})} /></div></div><div className="input-row"><div className="input-group"><label>Cant.</label><input type="number" min="1" value={newItem.qty} onChange={e => setNewItem({...newItem, qty: e.target.value})} /></div><div className="input-group"><label>Costo Uni ($)</label><input type="number" step="0.01" value={newItem.unitPrice} onChange={e => setNewItem({...newItem, unitPrice: e.target.value})} /></div></div><button type="button" className="btn-secondary full-width" onClick={handleAddItemToTicket}>Añadir a la lista</button></div>{ticketItems.length > 0 && ( <div className="mini-table-container"><table className="mini-table"><thead><tr><th>SKU</th><th>Cant.</th><th>Descripción</th><th>Total</th><th></th></tr></thead><tbody>{ticketItems.map((item, index) => (<tr key={index}><td>{item.sku}</td><td>{item.qty}</td><td>{item.desc}</td><td>${item.itemTotal.toFixed(2)}</td><td><button type="button" className="btn-icon delete" onClick={() => handleRemoveItemFromTicket(index)}>✖</button></td></tr>))}</tbody></table></div> )}<div className="financial-inputs"><div className="input-row"><div className="input-group"><label>Subtotal</label><div className="auto-calc">${ticketSubtotal.toFixed(2)}</div></div><div className="input-group"><label>IVA (16%)</label><div className="auto-calc">${ticketIVA.toFixed(2)}</div></div></div><div className="input-group"><label style={{color: 'var(--accent-color)', fontWeight: 'bold'}}>Total Ticket</label><div className="auto-calc total-calc">${ticketTotal.toFixed(2)}</div></div></div><button type="submit" className="btn-primary full-width" style={{marginTop: '1rem'}}>Guardar Ticket Contable</button></form></section>
          )}
          {ticketTab === 'historial' && (
            <div style={{width: '100%', maxWidth: '1200px', display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem'}}><div className="summary-grid" style={{marginBottom: 0}}><div className="summary-card"><h4>Gasto (Sin IVA)</h4><div className="amount">${historyTotalSubtotal.toFixed(2)}</div></div><div className="summary-card"><h4>IVA Pagado</h4><div className="amount">${historyTotalIVA.toFixed(2)}</div></div><div className="summary-card total"><h4>Gasto Total Real</h4><div className="amount">${historyTotalGasto.toFixed(2)}</div></div></div><div className="list-section" style={{flex: 'none', height: 'auto'}}><h2>Registros Contables</h2><div className="table-container"><table className="data-table"><thead><tr><th>ID Ticket</th><th>Fecha</th><th>Proveedor</th><th>Subtotal</th><th>IVA</th><th>Total Pagado</th><th>Acciones</th></tr></thead><tbody>{ticketHistory.map((ticket, index) => (ticket.total > 0 && ( <tr key={index}><td style={{fontSize: '0.85rem', color: '#64748b'}}>{ticket.id}</td><td><span className="status-badge ok">{ticket.date}</span></td><td><strong>{ticket.provider}</strong></td><td style={{color: '#64748b'}}>${ticket.subtotal.toFixed(2)}</td><td style={{color: '#64748b'}}>${ticket.iva.toFixed(2)}</td><td style={{fontWeight: 'bold', color: 'var(--primary-color)', fontSize: '1.1rem'}}>${ticket.total.toFixed(2)}</td><td><button className="btn-icon" onClick={() => setSelectedTicket(ticket)}>👁️ Ver Detalle</button></td></tr> )))}</tbody></table></div></div></div>
          )}
        </main>
      </div>
    )
  }

  if (isLoggedIn && activeView === 'control_inventario') {
    return (
      <div className="pos-container" style={themeStyles}>
        <header className="header"><button className="back-btn" onClick={() => setActiveView('dashboard')}>⬅ Volver al Menú</button><h1>Control de Inventario y Ajustes</h1><button className="logout-btn" onClick={handleLogout}>Cerrar Sesión</button></header>
        <main className="main-content" style={{gap: '2rem'}}>
          <section className="form-section" style={{flex: 1}}>
            <h2>Registrar Ajuste Físico</h2>
            <p style={{marginBottom: '1.5rem', color: '#64748b', fontSize: '0.9rem'}}>Usa este módulo para registrar productos dañados, caducados, o diferencias en tu conteo físico de mercancía.</p>
            <form className="custom-form" onSubmit={handleApplyAdjustment}>
              <div className="input-group"><label>SKU del Producto</label><select className="role-select" value={adjustData.sku} onChange={e => setAdjustData({...adjustData, sku: e.target.value})} required><option value="">Selecciona un producto...</option>{inventory.map((p, i) => <option key={i} value={p.sku}>{p.sku} - {p.name} (Stock: {p.stock})</option>)}</select></div>
              <div className="input-row">
                <div className="input-group"><label>Tipo de Movimiento</label><select className="role-select" value={adjustData.type} onChange={e => setAdjustData({...adjustData, type: e.target.value})}><option value="salida">🔴 Salida (Resta)</option><option value="entrada">🟢 Entrada (Suma)</option></select></div>
                <div className="input-group"><label>Cantidad (Piezas)</label><input type="number" min="1" value={adjustData.qty} onChange={e => setAdjustData({...adjustData, qty: e.target.value})} required /></div>
              </div>
              <div className="input-group"><label>Motivo del Ajuste</label><select className="role-select" value={adjustData.reason} onChange={e => setAdjustData({...adjustData, reason: e.target.value})}>{adjustData.type === 'salida' ? (<><option value="Merma / Dañado">Merma / Producto Dañado</option><option value="Caducidad">Producto Caducado</option><option value="Robo / Extravío">Robo / Extravío</option><option value="Consumo Interno">Consumo del Personal</option><option value="Ajuste de Conteo">Ajuste por Conteo Físico</option></>) : (<><option value="Ajuste de Conteo">Ajuste por Conteo Físico (Sobrante)</option><option value="Devolución de Cliente">Devolución de Cliente</option><option value="Bonificación">Bonificación de Proveedor</option></>)}</select></div>
              <button type="submit" className="btn-primary full-width" style={{marginTop: '1rem'}}>Aplicar Ajuste al Stock</button>
            </form>
          </section>
          <aside className="list-section" style={{flex: 2, display: 'flex', flexDirection: 'column'}}>
            <h2>Historial de Movimientos (Kardex Manual)</h2>
            <div className="table-container" style={{flex: 1, overflowY: 'auto'}}>
              {adjustmentHistory.length === 0 ? (<p style={{color: '#64748b', textAlign: 'center', marginTop: '2rem'}}>No hay ajustes registrados aún.</p>) : (
                <table className="data-table"><thead><tr><th>Fecha</th><th>Producto</th><th>Tipo</th><th>Cant.</th><th>Motivo</th><th>Stock Final</th></tr></thead><tbody>{adjustmentHistory.map((record, index) => (<tr key={index}><td style={{fontSize: '0.8rem', color: '#64748b'}}>{record.date}</td><td><strong>{record.name}</strong><br/><small>{record.sku}</small></td><td><span className={`status-badge ${record.type === 'entrada' ? 'ok' : 'danger'}`}>{record.type}</span></td><td style={{fontWeight: 'bold'}}>{record.qty}</td><td>{record.reason}</td><td style={{color: 'var(--primary-color)', fontWeight: 'bold'}}>{record.newStock}</td></tr>))}</tbody></table>
              )}
            </div>
          </aside>
        </main>
      </div>
    )
  }

  return (
    <div className="dashboard-container construction-view" style={themeStyles}>
      <div className="construction-box"><h2>🛠️ Módulo en Construcción</h2><button className="btn-primary" onClick={() => setActiveView('dashboard')}>Volver al Menú Principal</button></div>
    </div>
  )
  
}
export default App