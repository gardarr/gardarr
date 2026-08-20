import { Card, CardContent } from "@/components/ui/card";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  Calendar,
  Link2,
  Copy,
  Clock,
  CheckCircle,
  XCircle,
  Crown,
  User
} from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router";
import { userService } from "./services/users";
import { signupService } from "./services/signup";
import { authService } from "./services/auth";
import type { User as UserManagementUser, UpdateUserRequest } from "./types/user";
import type { SignupToken, CreateSignupTokenRequest } from "./types/signup";
import { toast } from "sonner";
import { useAuth } from "./contexts/auth-hooks";

type SortType = "email" | "created_at" | "role";

function Users() {
  const { user: currentUser, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserManagementUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<SortType>("email");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [selectedUser, setSelectedUser] = useState<UserManagementUser | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserManagementUser | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [userToEdit, setUserToEdit] = useState<UserManagementUser | null>(null);
  const [editForm, setEditForm] = useState<UpdateUserRequest>({
    email: "",
    password: "",
    role: "user"
  });
  
  // Password reset states
  const [passwordResetLink, setPasswordResetLink] = useState<string | null>(null);
  const [showPasswordResetLink, setShowPasswordResetLink] = useState(false);
  
  // Magic link states
  const [showMagicLinksModal, setShowMagicLinksModal] = useState(false);
  const [magicLinks, setMagicLinks] = useState<SignupToken[]>([]);
  const [loadingMagicLinks, setLoadingMagicLinks] = useState(false);
  const [showCreateMagicLinkForm, setShowCreateMagicLinkForm] = useState(false);
  const [createMagicLinkForm, setCreateMagicLinkForm] = useState<CreateSignupTokenRequest>({
    email: "",
    role: "user",
    expires_in: 168 // 7 days default (in hours)
  });
  

  // Check if current user is admin
  const isAdmin = currentUser?.role === 'admin';

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await userService.listUsers();
      
      if (response.error) {
        toast.error(response.error);
      } else if (response.data) {
        setUsers(response.data.users || []);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  // Redirect non-admin users to dashboard
  useEffect(() => {
    // Only redirect if authentication is complete and user is confirmed to not be admin
    if (!authLoading && currentUser && !isAdmin) {
      navigate('/', { replace: true });
    }
  }, [authLoading, currentUser, isAdmin, navigate]);

  // Load users on component mount
  useEffect(() => {
    if (isAdmin) {
      loadUsers();
    }
  }, [isAdmin, loadUsers]);

  const loadMagicLinks = async () => {
    try {
      setLoadingMagicLinks(true);
      const response = await signupService.listMagicLinks();
      
      if (response.error) {
        toast.error(response.error);
      } else if (response.data) {
        setMagicLinks(response.data);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load magic links');
    } finally {
      setLoadingMagicLinks(false);
    }
  };

  const handleCreateMagicLink = async () => {
    try {
      const data: CreateSignupTokenRequest = {
        role: createMagicLinkForm.role,
        expires_in: createMagicLinkForm.expires_in
      };
      
      // Only include email if it's not empty
      if (createMagicLinkForm.email && createMagicLinkForm.email.trim()) {
        data.email = createMagicLinkForm.email.trim();
      }

      const response = await signupService.createMagicLink(data);
      if (response.error) {
        toast.error(response.error);
      } else if (response.data) {
        // Convert response to SignupToken format
        const newToken: SignupToken = {
          token: response.data.token,
          email: response.data.email,
          role: response.data.role,
          expires_at: response.data.expires_at,
          created_at: response.data.created_at,
          used: false
        };
        setMagicLinks([newToken, ...magicLinks]);
        toast.success('Magic link created successfully');
        setCreateMagicLinkForm({ 
          email: "", 
          role: "user", 
          expires_in: 168 
        });
        setShowCreateMagicLinkForm(false);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create magic link');
    }
  };

  const handleRevokeMagicLink = async (magicLink: SignupToken) => {
    try {
      const response = await signupService.revokeMagicLink(magicLink.token);
      if (response.error) {
        toast.error(response.error);
      } else {
        setMagicLinks(magicLinks.filter(link => link.token !== magicLink.token));
        toast.success('Magic link revoked successfully');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to revoke magic link');
    }
  };

  const copyMagicLink = async (magicLink: SignupToken) => {
    const url = signupService.getSignupUrl(magicLink.token);
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Magic link copied to clipboard');
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const openMagicLinksModal = () => {
    setShowMagicLinksModal(true);
    loadMagicLinks();
  };

  const handleRequestPasswordReset = async () => {
    if (!userToEdit) return;

    try {
      const response = await authService.requestPasswordReset(userToEdit.uuid);
      if (response.error) {
        toast.error(response.error);
      } else if (response.data) {
        // Generate the password reset URL
        const resetUrl = `${window.location.origin}/reset-password?token=${response.data.token}`;
        setPasswordResetLink(resetUrl);
        setShowPasswordResetLink(true);
        toast.success('Password reset link generated successfully');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate password reset link');
    }
  };

  const copyPasswordResetLink = async () => {
    if (!passwordResetLink) return;
    
    try {
      await navigator.clipboard.writeText(passwordResetLink);
      toast.success('Password reset link copied to clipboard');
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const confirmDeleteUser = (user: UserManagementUser) => {
    setUserToDelete(user);
    setShowDeleteModal(true);
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    try {
      const response = await userService.deleteUser(userToDelete.uuid);
      if (response.error) {
        toast.error(response.error);
      } else {
        setUsers(users.filter(user => user.uuid !== userToDelete.uuid));
        toast.success('User deleted successfully');
        setShowDeleteModal(false);
        setShowDetailsModal(false);
        setUserToDelete(null);
        setSelectedUser(null);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete user');
    }
  };

  const showUserDetails = (user: UserManagementUser) => {
    setSelectedUser(user);
    setShowDetailsModal(true);
  };

  const showEditUser = (user: UserManagementUser) => {
    setUserToEdit(user);
    setEditForm({
      email: user.email,
      password: "", // Don't pre-fill password for security
      role: user.founder ? "admin" : (user.role || "user") // Founders are always admin
    });
    // Reset password reset states
    setPasswordResetLink(null);
    setShowPasswordResetLink(false);
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
    // Don't allow role changes for founders
    if (!userToEdit.founder && editForm.role && editForm.role !== userToEdit.role) {
      updateData.role = editForm.role;
    }

    // If no changes, show message and return
    if (Object.keys(updateData).length === 0) {
      toast.error('No changes detected');
      return;
    }

    try {
      const response = await userService.updateUser(userToEdit.uuid, updateData);
      if (response.error) {
        toast.error(response.error);
      } else if (response.data) {
        // Update the user in the list
        setUsers(users.map(user => 
          user.uuid === userToEdit.uuid ? response.data! : user
        ));
        toast.success('User updated successfully');
        setShowEditModal(false);
        setShowDetailsModal(false);
        setUserToEdit(null);
        setSelectedUser(null);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update user');
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

  // Show loading while checking authentication or if user is not admin
  if (authLoading || (currentUser && !isAdmin)) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <UsersIcon className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Users</h1>
            <p className="text-sm text-muted-foreground">Manage user accounts and permissions</p>
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <Button onClick={loadUsers} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={openMagicLinksModal} size="sm">
            <Link2 className="h-4 w-4 mr-2" />
            Invite User
          </Button>
        </div>
      </div>

      {/* Info Card */}
      <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
              <Link2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                Invite-Only Registration
              </h3>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                New users can only be added through invitations. Click "Invite User" to generate a magic link that can be shared with new users.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

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
              {searchTerm ? 'No users match your search criteria.' : 'Get started by inviting your first user.'}
            </p>
            {!searchTerm && (
              <Button onClick={openMagicLinksModal}>
                <Link2 className="h-4 w-4 mr-2" />
                Invite User
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block">
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-4 font-medium text-muted-foreground">User</th>
                      <th 
                        className="text-left p-4 font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                        onClick={() => {
                          if (sortBy === "role") {
                            setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                          } else {
                            setSortBy("role");
                            setSortOrder("asc");
                          }
                        }}
                      >
                        <div className="flex items-center gap-2">
                          Role
                          {sortBy === "role" && (
                            <span className="text-xs">
                              {sortOrder === "asc" ? "↑" : "↓"}
                            </span>
                          )}
                        </div>
                      </th>
                      <th className="text-left p-4 font-medium text-muted-foreground">Status</th>
                      <th 
                        className="text-left p-4 font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                        onClick={() => {
                          if (sortBy === "created_at") {
                            setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                          } else {
                            setSortBy("created_at");
                            setSortOrder("asc");
                          }
                        }}
                      >
                        <div className="flex items-center gap-2">
                          Created
                          {sortBy === "created_at" && (
                            <span className="text-xs">
                              {sortOrder === "asc" ? "↑" : "↓"}
                            </span>
                          )}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => (
                      <tr 
                        key={user.uuid} 
                        className="cursor-pointer hover:bg-muted/50 transition-colors border-b last:border-b-0"
                        onClick={() => showUserDetails(user)}
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <Mail className="h-5 w-5 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium truncate flex items-center gap-2">
                                {user.email}
                                {user.founder && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Crown className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Founder</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground">UUID: {user.uuid}</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className={`text-xs font-medium px-2 py-1 rounded-full ${getRoleBadgeColor(user.role)} flex items-center gap-1 w-fit`}>
                                  {user.role === 'admin' ? <Shield className="h-4 w-4" /> : <User className="h-4 w-4" />}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{user.role === 'admin' ? 'Administrator' : 'User'}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </td>
                        <td className="p-4">
                          {/* Status column - can be used for other status indicators in the future */}
                        </td>
                        <td className="p-4">
                          <div className="text-sm text-muted-foreground">
                            {formatDate(user.created_at)}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden grid gap-3">
            {filteredUsers.map((user) => (
              <Card 
                key={user.uuid} 
                className="relative cursor-pointer hover:container-content-background/50 transition-colors"
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
                        <h3 className="font-semibold text-base truncate flex items-center gap-2">
                          {user.email}
                          {user.founder && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Crown className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Founder</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </h3>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getRoleBadgeColor(user.role)} flex items-center gap-1`}>
                                {user.role === 'admin' ? <Shield className="h-4 w-4" /> : <User className="h-4 w-4" />}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{user.role === 'admin' ? 'Administrator' : 'User'}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>Created {formatDate(user.created_at)}</span>
                      </div>
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
                  <div className="flex items-center gap-3 p-3 container-content-background/50 rounded-lg">
                    <div className="w-14 h-14 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Mail className="h-7 w-7 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-base flex items-center gap-2">
                        {selectedUser.email}
                        {selectedUser.founder && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Crown className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Founder</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </h3>
                      <p className="text-xs text-muted-foreground">UUID: {selectedUser.uuid}</p>
                    </div>
                    <div className="flex flex-col gap-1">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className={`text-xs font-medium px-2 py-1 rounded-full ${getRoleBadgeColor(selectedUser.role)} flex items-center gap-1`}>
                              {selectedUser.role === 'admin' ? <Shield className="h-4 w-4" /> : <User className="h-4 w-4" />}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{selectedUser.role === 'admin' ? 'Administrator' : 'User'}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>

                  <div className="space-y-2 p-3 container-content-background/50 rounded-lg">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Email:</span>
                      <span className="font-medium">{selectedUser.email}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Role:</span>
                      <span className="font-medium capitalize">{selectedUser.role || 'user'}</span>
                    </div>
                    {selectedUser.founder && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Status:</span>
                        <span className="font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
                          <Crown className="h-3 w-3" />
                          Founder
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Created:</span>
                      <span className="font-medium">{formatDate(selectedUser.created_at)}</span>
                    </div>
                  </div>

                  {selectedUser.founder && (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg">
                      <div className="flex items-start gap-2">
                        <Crown className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                            Founder Account
                          </p>
                          <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                            This user is a founder and cannot be deleted from the system.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 justify-between pt-2">
                    <Button 
                      variant="destructive" 
                      disabled={selectedUser.founder}
                      onClick={() => !selectedUser.founder && confirmDeleteUser(selectedUser)}
                      title={selectedUser.founder ? "Founder users cannot be deleted" : "Delete user"}
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
                  {userToDelete.founder ? (
                    <>
                      <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg">
                        <div className="flex items-start gap-2">
                          <Crown className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                              Cannot Delete Founder
                            </p>
                            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                              Founder users cannot be deleted from the system for security reasons.
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 p-3 container-content-background/50 rounded-lg">
                        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Mail className="h-6 w-6 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-sm flex items-center gap-2">
                            {userToDelete.email}
                            {userToDelete.founder && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Crown className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Founder</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </h3>
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
                          Close
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-muted-foreground">
                        Are you sure you want to delete this user? This action cannot be undone.
                      </p>
                      
                      <div className="flex items-center gap-3 p-3 container-content-background/50 rounded-lg">
                        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Mail className="h-6 w-6 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-sm flex items-center gap-2">
                            {userToDelete.email}
                            {userToDelete.founder && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Crown className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Founder</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </h3>
                          <div className="flex items-center gap-1">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    {userToDelete.role === 'admin' ? <Shield className="h-4 w-4" /> : <User className="h-4 w-4" />}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{userToDelete.role === 'admin' ? 'Administrator' : 'User'}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
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
                    </>
                  )}
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
                  {userToEdit.founder && (
                    <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg">
                      <Crown className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      <div>
                        <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                          Founder Account
                        </p>
                        <p className="text-xs text-amber-700 dark:text-amber-300">
                          This is a founder account and cannot be modified.
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-email" className="text-sm">Email</Label>
                    <Input
                      id="edit-email"
                      type="email"
                      placeholder="user@example.com"
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      className="h-9"
                      disabled
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
                        disabled={userToEdit.founder}
                      >
                        User
                      </Button>
                      <Button
                        type="button"
                        variant={editForm.role === "admin" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setEditForm({ ...editForm, role: "admin" })}
                        disabled={userToEdit.founder}
                      >
                        <Shield className="h-3 w-3 mr-1" />
                        Admin
                      </Button>
                    </div>
                  </div>

                  {/* Password Reset Section */}
                  <div className="space-y-3 pt-2 border-t">
                    <div className="space-y-1.5">
                      <Label className="text-sm">Password Reset</Label>
                      <p className="text-xs text-muted-foreground">
                        Generate a password reset link for this user
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleRequestPasswordReset}
                        className="w-full"
                        disabled={userToEdit.founder}
                      >
                        <Link2 className="h-4 w-4 mr-2" />
                        Generate Password Reset Link
                      </Button>
                    </div>

                    {/* Password Reset Link Display */}
                    {showPasswordResetLink && passwordResetLink && (
                      <div className="space-y-2 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg">
                        <div className="flex items-start gap-2">
                          <Link2 className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                              Password Reset Link Generated
                            </p>
                            <p className="text-xs text-blue-700 dark:text-blue-300 mb-2">
                              Share this link with the user to reset their password. The link will expire in 1 hour.
                            </p>
                            <div className="flex gap-2 items-start">
                              <code className="text-xs bg-white dark:bg-gray-800 px-2 py-1 rounded border break-all min-w-0 flex-1">
                                {passwordResetLink}
                              </code>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={copyPasswordResetLink}
                                className="flex-shrink-0"
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
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
                    <Button 
                      onClick={handleUpdateUser} 
                      size="sm"
                      disabled={userToEdit.founder}
                      title={userToEdit.founder ? "Founder accounts cannot be modified" : "Update user information"}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Update User
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Magic Links Management Modal */}
          <Dialog open={showMagicLinksModal} onOpenChange={setShowMagicLinksModal}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Manage Magic Links</DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4">
                {/* Create Magic Link Form */}
                {!showCreateMagicLinkForm ? (
                  <Button onClick={() => setShowCreateMagicLinkForm(true)} size="sm" className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Create New Magic Link
                  </Button>
                ) : (
                  <Card>
                    <CardContent className="pt-4 space-y-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="magic-link-email" className="text-sm">Email (optional)</Label>
                        <Input
                          id="magic-link-email"
                          type="email"
                          placeholder="user@example.com (leave empty for generic link)"
                          value={createMagicLinkForm.email}
                          onChange={(e) => setCreateMagicLinkForm({ ...createMagicLinkForm, email: e.target.value })}
                          className="h-9"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="magic-link-role" className="text-sm">Role</Label>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant={createMagicLinkForm.role === "user" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCreateMagicLinkForm({ ...createMagicLinkForm, role: "user" })}
                          >
                            User
                          </Button>
                          <Button
                            type="button"
                            variant={createMagicLinkForm.role === "admin" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCreateMagicLinkForm({ ...createMagicLinkForm, role: "admin" })}
                          >
                            <Shield className="h-3 w-3 mr-1" />
                            Admin
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="magic-link-expires" className="text-sm">Expires In</Label>
                        <div className="flex gap-2">
                          {[24, 168, 720].map((hours) => (
                            <Button
                              key={hours}
                              type="button"
                              variant={createMagicLinkForm.expires_in === hours ? "default" : "outline"}
                              size="sm"
                              onClick={() => setCreateMagicLinkForm({ ...createMagicLinkForm, expires_in: hours })}
                            >
                              {hours === 24 ? '1 day' : hours === 168 ? '7 days' : '30 days'}
                            </Button>
                          ))}
                        </div>
                      </div>

                      <div className="flex gap-2 justify-end pt-1">
                        <Button 
                          variant="outline" 
                          onClick={() => {
                            setShowCreateMagicLinkForm(false);
                            setCreateMagicLinkForm({ email: "", role: "user", expires_in: 168 });
                          }} 
                          size="sm"
                        >
                          Cancel
                        </Button>
                        <Button onClick={handleCreateMagicLink} size="sm">
                          <Check className="h-4 w-4 mr-1" />
                          Create Magic Link
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Magic Links List */}
                {loadingMagicLinks ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-muted-foreground">Loading magic links...</span>
                  </div>
                ) : magicLinks.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Link2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No magic links created yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {magicLinks.map((magicLink) => {
                      const isExpired = new Date(magicLink.expires_at) < new Date();
                      const isUsed = magicLink.used;
                      
                      return (
                        <Card key={magicLink.token} className={isUsed || isExpired ? 'opacity-60' : ''}>
                          <CardContent className="p-4">
                            <div className="flex gap-3 items-start">
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                isUsed ? 'bg-green-100 dark:bg-green-900/30' : 
                                isExpired ? 'bg-red-100 dark:bg-red-900/30' : 
                                'bg-blue-100 dark:bg-blue-900/30'
                              }`}>
                                {isUsed ? (
                                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                                ) : isExpired ? (
                                  <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                                ) : (
                                  <Link2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                )}
                              </div>

                              <div className="flex-1 min-w-0 space-y-1">
                                <div className="flex items-center gap-2">
                                  {magicLink.email ? (
                                    <span className="text-sm font-medium truncate">{magicLink.email}</span>
                                  ) : (
                                    <span className="text-sm font-medium text-muted-foreground">Generic Link</span>
                                  )}
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${getRoleBadgeColor(magicLink.role)} flex items-center gap-1`}>
                                          {magicLink.role === 'admin' ? <Shield className="h-4 w-4" /> : <User className="h-4 w-4" />}
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>{magicLink.role === 'admin' ? 'Administrator' : 'User'}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                  {isUsed && (
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                                      Used
                                    </span>
                                  )}
                                  {isExpired && !isUsed && (
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                                      Expired
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                  <div className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    <span>Expires {formatDate(magicLink.expires_at)}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    <span>Created {formatDate(magicLink.created_at)}</span>
                                  </div>
                                </div>

                                {!isUsed && !isExpired && (
                                  <div className="flex items-center gap-2 mt-2">
                                    <code className="text-xs container-content-background/50 px-2 py-1 rounded flex-1 truncate">
                                      {signupService.getSignupUrl(magicLink.token)}
                                    </code>
                                  </div>
                                )}

                                {isUsed && magicLink.used_at && (
                                  <div className="text-xs text-muted-foreground">
                                    Used on {formatDate(magicLink.used_at)}
                                  </div>
                                )}
                              </div>

                              <div className="flex gap-1">
                                {!isUsed && !isExpired && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => copyMagicLink(magicLink)}
                                    >
                                      <Copy className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleRevokeMagicLink(magicLink)}
                                    >
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}

export default Users;
