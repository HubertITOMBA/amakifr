"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Users, 
  Search, 
  Filter,
  MoreHorizontal,
  Edit,
  Trash2,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Shield,
  UserCheck,
  UserX
} from "lucide-react";
import { useState } from "react";

// Données d'exemple pour les utilisateurs
const users = [
  {
    id: 1,
    name: "Jean Dupont",
    email: "jean.dupont@email.com",
    role: "MEMBER",
    status: "active",
    joinDate: "2024-01-15",
    lastLogin: "2024-02-10",
    phone: "+33 6 12 34 56 78",
    location: "Paris, France"
  },
  {
    id: 2,
    name: "Marie Martin",
    email: "marie.martin@email.com",
    role: "ADMIN",
    status: "active",
    joinDate: "2023-06-20",
    lastLogin: "2024-02-12",
    phone: "+33 6 23 45 67 89",
    location: "Lyon, France"
  },
  {
    id: 3,
    name: "Pierre Durand",
    email: "pierre.durand@email.com",
    role: "MEMBER",
    status: "inactive",
    joinDate: "2023-12-05",
    lastLogin: "2024-01-20",
    phone: "+33 6 34 56 78 90",
    location: "Marseille, France"
  },
  {
    id: 4,
    name: "Sophie Bernard",
    email: "sophie.bernard@email.com",
    role: "MEMBER",
    status: "active",
    joinDate: "2024-02-01",
    lastLogin: "2024-02-11",
    phone: "+33 6 45 67 89 01",
    location: "Toulouse, France"
  }
];

export default function AdminUsers() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === "all" || user.role === filterRole;
    const matchesStatus = filterStatus === "all" || user.status === filterStatus;
    
    return matchesSearch && matchesRole && matchesStatus;
  });

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "ADMIN":
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Admin</Badge>;
      case "MEMBER":
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">Membre</Badge>;
      default:
        return <Badge variant="secondary">Inconnu</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Actif</Badge>;
      case "inactive":
        return <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200">Inactif</Badge>;
      default:
        return <Badge variant="secondary">Inconnu</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Gestion des Utilisateurs
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2">
            Gérez les membres de l'association
          </p>
        </div>
        <Button className="flex items-center space-x-2">
          <Users className="h-4 w-4" />
          <span>Ajouter un membre</span>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-300">
              Total Membres
            </CardTitle>
            <Users className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {users.length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-300">
              Membres Actifs
            </CardTitle>
            <UserCheck className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {users.filter(u => u.status === "active").length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-300">
              Administrateurs
            </CardTitle>
            <Shield className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {users.filter(u => u.role === "ADMIN").length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-300">
              Nouveaux ce mois
            </CardTitle>
            <Calendar className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {users.filter(u => new Date(u.joinDate) > new Date('2024-02-01')).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-4 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Rechercher un utilisateur..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <div className="flex gap-2">
                <select
                  value={filterRole}
                  onChange={(e) => setFilterRole(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="all">Tous les rôles</option>
                  <option value="ADMIN">Administrateurs</option>
                  <option value="MEMBER">Membres</option>
                </select>
                
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="all">Tous les statuts</option>
                  <option value="active">Actifs</option>
                  <option value="inactive">Inactifs</option>
                </select>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Liste des utilisateurs ({filteredUsers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredUsers.map((user) => (
              <div key={user.id} className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                      {user.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                        {user.name}
                      </h3>
                      {getRoleBadge(user.role)}
                      {getStatusBadge(user.status)}
                    </div>
                    <div className="flex items-center space-x-4 mt-1">
                      <div className="flex items-center space-x-1 text-sm text-gray-500 dark:text-gray-400">
                        <Mail className="h-3 w-3" />
                        <span>{user.email}</span>
                      </div>
                      <div className="flex items-center space-x-1 text-sm text-gray-500 dark:text-gray-400">
                        <Phone className="h-3 w-3" />
                        <span>{user.phone}</span>
                      </div>
                      <div className="flex items-center space-x-1 text-sm text-gray-500 dark:text-gray-400">
                        <MapPin className="h-3 w-3" />
                        <span>{user.location}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4 mt-1">
                      <div className="flex items-center space-x-1 text-xs text-gray-500 dark:text-gray-400">
                        <Calendar className="h-3 w-3" />
                        <span>Inscrit le {new Date(user.joinDate).toLocaleDateString('fr-FR')}</span>
                      </div>
                      <div className="flex items-center space-x-1 text-xs text-gray-500 dark:text-gray-400">
                        <span>Dernière connexion: {new Date(user.lastLogin).toLocaleDateString('fr-FR')}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Button variant="outline" size="sm">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

