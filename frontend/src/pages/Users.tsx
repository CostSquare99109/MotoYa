import { useState, useEffect } from 'react';
import { useApi } from '@/hooks/useApi';
import type { User, UserRole } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Users, Plus, Search, Pencil, Trash2, ShieldCheck, Bike,
  User as UserIcon, Loader2, AlertCircle,
} from 'lucide-react';

const ROLE_LABEL: Record<UserRole, string> = {
  admin:  'Administrador',
  worker: 'Conductor',
  client: 'Pasajero',
};

const ROLE_ICON: Record<UserRole, React.ComponentType<{ className?: string }>> = {
  admin:  ShieldCheck,
  worker: Bike,
  client: UserIcon,
};

const ROLE_COLOR: Record<UserRole, string> = {
  admin:  'bg-violet-100 text-violet-700',
  worker: 'bg-orange-100 text-orange-700',
  client: 'bg-sky-100 text-sky-700',
};

const STATUS_COLOR: Record<string, string> = {
  active:    'bg-green-100 text-green-700',
  suspended: 'bg-red-100 text-red-700',
  pending:   'bg-yellow-100 text-yellow-700',
};

const EMPTY_FORM = {
  full_name: '', email: '', phone: '',
  role: 'client' as UserRole, status: 'active', password: '',
};

export default function UsersPage() {
  const api = useApi();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ─── Load ──────────────────────────────────────────────────────────────────

  const load = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await api.get<User[]>('/api/users');
      setUsers(data);
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : 'Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // ─── Filter ────────────────────────────────────────────────────────────────

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    const matchSearch =
      u.full_name.toLowerCase().includes(q) ||
      (u.email ?? '').toLowerCase().includes(q) ||
      (u.phone ?? '').includes(q);
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  // ─── Modal helpers ─────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditUser(null);
    setForm({ ...EMPTY_FORM });
    setSaveError('');
    setModalOpen(true);
  };

  const openEdit = (u: User) => {
    setEditUser(u);
    setForm({
      full_name: u.full_name,
      email: u.email ?? '',
      phone: u.phone ?? '',
      role: u.role,
      status: u.status,
      password: '',
    });
    setSaveError('');
    setModalOpen(true);
  };

  // ─── Save ──────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!form.full_name.trim()) { setSaveError('El nombre es obligatorio'); return; }
    setSaveError('');
    setSaving(true);
    try {
      if (editUser) {
        // PATCH real al backend
        const updated = await api.patch<User>(`/api/users/${editUser.id}`, {
          full_name: form.full_name,
          email:     form.email || undefined,
          // ✅ FIX: phone ahora se envía en el PATCH — antes estaba ausente
          phone:     form.phone || undefined,
          role:      form.role,
          status:    form.status,
          password:  form.password || undefined,
        });
        setUsers(prev => prev.map(u => u.id === editUser.id ? updated : u));
      } else {
        // POST real al backend
        const created = await api.post<User>('/api/users', {
          full_name: form.full_name,
          email:     form.email || undefined,
          phone:     form.phone || undefined,
          role:      form.role,
          status:    form.status,
          password:  form.password || undefined,
        });
        setUsers(prev => [created, ...prev]);
      }
      setModalOpen(false);
    } catch (err: unknown) {
      // Mostrar el error real del backend (detail del 409, 400, etc.)
      setSaveError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  // ─── Delete ────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.del(`/api/users/${deleteTarget.id}`);
      setUsers(prev => prev.filter(u => u.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al eliminar');
    } finally {
      setDeleting(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Users className="w-6 h-6 text-[#f97316]" />
            Usuarios
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Gestión de administradores, conductores y pasajeros
          </p>
        </div>
        <Button onClick={openCreate} className="bg-[#f97316] hover:bg-[#ea580c]">
          <Plus className="w-4 h-4 mr-2" />Nuevo usuario
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Buscar por nombre, email o teléfono…"
              className="pl-9"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Select value={roleFilter} onValueChange={v => setRoleFilter(v as UserRole | 'all')}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los roles</SelectItem>
              <SelectItem value="admin">Administrador</SelectItem>
              <SelectItem value="worker">Conductor</SelectItem>
              <SelectItem value="client">Pasajero</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Error de carga */}
      {loadError && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {loadError}
          <button onClick={load} className="ml-auto underline text-xs">Reintentar</button>
        </div>
      )}

      {/* Table */}
      <Card>
        <CardHeader className="px-6 py-4 border-b">
          <CardTitle className="text-sm font-medium text-slate-500">
            {filtered.length} de {users.length} usuarios
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-[#f97316]" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Registro</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(user => {
                  const RoleIcon = ROLE_ICON[user.role] ?? UserIcon;
                  return (
                    <TableRow key={user.id} className="hover:bg-slate-50">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-semibold text-sm flex-shrink-0">
                            {user.full_name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-slate-800">{user.full_name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-500 text-sm">
                        {user.email ?? user.phone ?? '—'}
                      </TableCell>
                      <TableCell>
                        <Badge className={`${ROLE_COLOR[user.role] ?? 'bg-gray-100 text-gray-600'} border-0 gap-1`}>
                          <RoleIcon className="w-3 h-3" />
                          {ROLE_LABEL[user.role] ?? user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${STATUS_COLOR[user.status] ?? 'bg-gray-100 text-gray-600'} border-0 capitalize`}>
                          {user.status === 'active' ? 'Activo'
                            : user.status === 'suspended' ? 'Suspendido'
                            : user.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-400 text-sm">
                        {new Date(user.created_at).toLocaleDateString('es-CO')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(user)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400 hover:text-red-600" onClick={() => setDeleteTarget(user)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && !loading && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12 text-center text-slate-400">
                      {loadError ? 'Error al cargar' : 'Sin resultados'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={open => { if (!saving) setModalOpen(open); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editUser ? 'Editar usuario' : 'Nuevo usuario'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nombre completo *</Label>
              <Input
                value={form.full_name}
                onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                placeholder="Ej: Carlos Martínez"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="correo@ejemplo.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Teléfono</Label>
                <Input
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="3001234567"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Rol</Label>
                <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v as UserRole }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="worker">Conductor</SelectItem>
                    <SelectItem value="client">Pasajero</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Estado</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Activo</SelectItem>
                    <SelectItem value="suspended">Suspendido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{editUser ? 'Nueva contraseña (opcional)' : 'Contraseña'}</Label>
              <Input
                type="password"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder={editUser ? 'Dejar vacío para no cambiar' : 'Mínimo 6 caracteres'}
              />
            </div>

            {/* Error del servidor */}
            {saveError && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2.5 rounded-lg">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                {saveError}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button
              className="bg-[#f97316] hover:bg-[#ea580c]"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {editUser ? 'Guardar cambios' : 'Crear usuario'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={v => !v && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar usuario</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            ¿Eliminar a <strong>{deleteTarget?.full_name}</strong>? Esta acción no se puede deshacer.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
