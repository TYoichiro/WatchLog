export type RouteContext = {
  params: Promise<{
    userId: string;
  }>;
};

export type AssignRoleResult =
  | {
      status: "assigned";
      userRoleId: string;
      role: {
        id: string;
        name: string;
      };
    }
  | {
      status: "target_user_not_found";
    }
  | {
      status: "role_not_found";
    }
  | {
      status: "admin_role_not_assignable";
    };
