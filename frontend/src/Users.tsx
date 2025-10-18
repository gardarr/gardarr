import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Users as UsersIcon, 
  Plus, 
  Trash2, 
  Search, 
  Loader2, 
  RefreshCw,
  X,
  Check,
  Mail,
  Shield,
  Calendar
} from "lucide-react";
import { useEffect, useState } from "react";
import { userService } from "./services/users";
import type { User, CreateUserRequest, UpdateUserRequest } from "./types/user";
import { useToast } from "./hooks/useToast";
import { ToastContainer } from "./components/ui/toast-container";

type SortType = "email" | "created_at" | "role";

function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<SortType>("email");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);
  const [createForm, setCreateForm] = useState<CreateUserRequest>({
    email: "",
    password: "",
    role: "user"
  });
  const [editForm, setEditForm] = useState<UpdateUserRequest>({
    email: "",
    password: "",
    role: "user"
  });
  
  const { toasts, showSuccess, showError, removeToast } = useToast();

  // Load users on component mount
  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await userService.listUsers();
      
      if (response.error) {
        showError(response.error);
      } else if (response.data) {
        setUsers(response.data.users || []);
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const confirmDeleteUser = (user: User) => {
    setUserToDelete(user);
    setShowDeleteModal(true);
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    try {
      const response = await userService.deleteUser(userToDelete.uuid);
      if (response.error) {
        showError(response.error);
      } else {
        setUsers(users.filter(user => user.uuid !== userToDelete.uuid));
        showSuccess('User deleted successfully');
        setShowDeleteModal(false);
        setShowDetailsModal(false);
        setUserToDelete(null);
        setSelectedUser(null);
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to delete user');
    }
  };

  const handleCreateUser = async () => {
    if (!createForm.email || !createForm.password) {
      showError('Please fill in all required fields');
      return;
    }

    try {
      const response = await userService.createUser(createForm);
      if (response.error) {
        showError(response.error);
      } else if (response.data) {
        setUsers([...users, response.data]);
        showSuccess('User created successfully');
        // Reset form
        setCreateForm({ 
          email: "", 
          password: "", 
          role: "user" 
        });
        setShowCreateForm(false);
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to create user');
    }
  };

  const showUserDetails = (user: User) => {
    setSelectedUser(user);
    setShowDetailsModal(true);
  };

  const showEditUser = (user: User) => {
    setUserToEdit(user);
    setEditForm({
      email: user.email,
      password: "", // Don't pre-fill password for security
      role: user.role || "user"
    });
    setShowEditModal(true);
  };

  const handleUpdateUser = async () => {
    if (!userToEdit) return;

    // Only include fields that have been changed
    const updateData: UpdateUserRequest = {};
    if (editForm.email && editForm.email !== userToEdit.email) {
      updateData.email = editForm.email;
    }
    if (editForm.password) {
      updateData.password = editForm.password;
    }
    if (editForm.role && editForm.role !== userToEdit.role) {
      updateData.role = editForm.role;
    }

    // If no changes, show message and return
    if (Object.keys(updateData).length === 0) {
      showError('No changes detected');
      return;
    }

    try {
      const response = await userService.updateUser(userToEdit.uuid, updateData);
      if (response.error) {
        showError(response.error);
      } else if (response.data) {
        // Update the user in the list
        setUsers(users.map(user => 
          user.uuid === userToEdit.uuid ? response.data! : user
        ));
        showSuccess('User updated successfully');
        setShowEditModal(false);
        setShowDetailsModal(false);
        setUserToEdit(null);
        setSelectedUser(null);
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to update user');
    }
  };

  // Filter and sort users
  const filteredUsers = users
    .filter(user => 
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      let comparison = 0;
      if (sortBy === "email") {
        comparison = a.email.localeCompare(b.email);
      } else if (sortBy === "created_at") {
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else if (sortBy === "role") {
        comparison = (a.role || "user").localeCompare(b.role || "user");
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const getRoleBadgeColor = (role?: string) => {
    switch (role) {
      case 'admin':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
      case 'user':
      default:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    }
  };

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <UsersIcon className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Users</h1>
            <p className="text-muted-foreground">Manage user accounts and permissions</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadUsers} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setShowCreateForm(!showCreateForm)} size="sm">
            {showCreateForm ? <X className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            {showCreateForm ? 'Cancel' : 'Add User'}
          </Button>
        </div>
      </div>

      {/* Create User Form */}
      {showCreateForm && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Create New User</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm">Password *</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter password"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  className="h-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="role" className="text-sm">Role</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={createForm.role === "user" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCreateForm({ ...createForm, role: "user" })}
                >
                  User
                </Button>
                <Button
                  type="button"
                  variant={createForm.role === "admin" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCreateForm({ ...createForm, role: "admin" })}
                >
                  <Shield className="h-3 w-3 mr-1" />
                  Admin
                </Button>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" onClick={() => setShowCreateForm(false)} size="sm">
                Cancel
              </Button>
              <Button onClick={handleCreateUser} size="sm">
                <Check className="h-4 w-4 mr-1" />
                Create User
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search and Sort */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (sortBy === "email") {
                setSortOrder(sortOrder === "asc" ? "desc" : "asc");
              } else {
                setSortBy("email");
                setSortOrder("asc");
              }
            }}
          >
            Email
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (sortBy === "role") {
                setSortOrder(sortOrder === "asc" ? "desc" : "asc");
              } else {
                setSortBy("role");
                setSortOrder("asc");
              }
            }}
          >
            Role
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (sortBy === "created_at") {
                setSortOrder(sortOrder === "asc" ? "desc" : "asc");
              } else {
                setSortBy("created_at");
                setSortOrder("asc");
              }
            }}
          >
            Date
          </Button>
        </div>
      </div>

      {/* Users List */}
      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Loading users...</span>
          </CardContent>
        </Card>
      ) : filteredUsers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <UsersIcon className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No users found</h3>
            <p className="text-muted-foreground text-center mb-4">
              {searchTerm ? 'No users match your search criteria.' : 'Get started by adding your first user.'}
            </p>
            {!searchTerm && (
              <Button onClick={() => setShowCreateForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add User
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-3">
            {filteredUsers.map((user) => (
              <Card 
                key={user.uuid} 
                className="relative cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => showUserDetails(user)}
              >
                <CardContent className="p-4">
                  <div className="flex gap-3 items-center">
                    {/* Icon */}
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Mail className="h-6 w-6 text-primary" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-base truncate">{user.email}</h3>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getRoleBadgeColor(user.role)}`}>
                          {user.role || 'user'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>Created {formatDate(user.created_at)}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          showEditUser(user);
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          confirmDeleteUser(user);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Details Modal */}
          <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>User Details</DialogTitle>
              </DialogHeader>
              
              {selectedUser && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-accent/50 rounded-lg">
                    <div className="w-14 h-14 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Mail className="h-7 w-7 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-base">{selectedUser.email}</h3>
                      <p className="text-xs text-muted-foreground">UUID: {selectedUser.uuid}</p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${getRoleBadgeColor(selectedUser.role)}`}>
                      {selectedUser.role || 'user'}
                    </span>
                  </div>

                  <div className="space-y-2 p-3 bg-accent/50 rounded-lg">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Email:</span>
                      <span className="font-medium">{selectedUser.email}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Role:</span>
                      <span className="font-medium capitalize">{selectedUser.role || 'user'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Created:</span>
                      <span className="font-medium">{formatDate(selectedUser.created_at)}</span>
                    </div>
                  </div>

                  <div className="flex gap-2 justify-between pt-2">
                    <Button 
                      variant="destructive" 
                      onClick={() => confirmDeleteUser(selectedUser)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        onClick={() => showEditUser(selectedUser)}
                      >
                        <Check className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                      <Button variant="outline" onClick={() => setShowDetailsModal(false)}>
                        <X className="h-4 w-4 mr-2" />
                        Close
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Delete Confirmation Modal */}
          <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Delete User</DialogTitle>
              </DialogHeader>
              
              {userToDelete && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Are you sure you want to delete this user? This action cannot be undone.
                  </p>
                  
                  <div className="flex items-center gap-3 p-3 bg-accent/50 rounded-lg">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Mail className="h-6 w-6 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-sm">{userToDelete.email}</h3>
                      <p className="text-xs text-muted-foreground">
                        {userToDelete.role === 'admin' ? 'Administrator' : 'User'}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end">
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setShowDeleteModal(false);
                        setUserToDelete(null);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button 
                      variant="destructive" 
                      onClick={handleDeleteUser}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Edit User Modal */}
          <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Edit User</DialogTitle>
              </DialogHeader>
              
              {userToEdit && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-email" className="text-sm">Email</Label>
                    <Input
                      id="edit-email"
                      type="email"
                      placeholder="user@example.com"
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      className="h-9"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="edit-password" className="text-sm">Password (leave empty to keep current)</Label>
                    <Input
                      id="edit-password"
                      type="password"
                      placeholder="New password"
                      value={editForm.password}
                      onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                      className="h-9"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="edit-role" className="text-sm">Role</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={editForm.role === "user" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setEditForm({ ...editForm, role: "user" })}
                      >
                        User
                      </Button>
                      <Button
                        type="button"
                        variant={editForm.role === "admin" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setEditForm({ ...editForm, role: "admin" })}
                      >
                        <Shield className="h-3 w-3 mr-1" />
                        Admin
                      </Button>
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end pt-1">
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setShowEditModal(false);
                        setUserToEdit(null);
                      }} 
                      size="sm"
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleUpdateUser} size="sm">
                      <Check className="h-4 w-4 mr-1" />
                      Update User
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}

export default Users;

