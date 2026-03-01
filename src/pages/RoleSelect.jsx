import { useNavigate } from "react-router-dom";
import "../role.css";
import BackButton from "../components/BackButton";

const RoleSelect = () => {
  const navigate = useNavigate();

  const chooseRole = (role) => {
    navigate(`/login/${role}`);
  };

  return (
    <div className="role-container">
      <BackButton to="/" />

     

      <h1 className="role-title">CHOOSE YOUR ROLE</h1>

      <div className="role-box">

        <div className="role-item">
          <img src="/group.png" alt="User" className="role-icon" />
          <button className="btn-role" onClick={() => chooseRole("user")}>
            USER
          </button>
        </div>

        <div className="role-item">
          <img src="/retailer.png" alt="Retailer" className="role-icon" />
          <button className="btn-role" onClick={() => chooseRole("retailer")}>
            RETAILER
          </button>
        </div>

        <div className="role-item">
          <img src="/conveyor.png" alt="Manufacturer" className="role-icon" />
          <button className="btn-role" onClick={() => chooseRole("manufacturer")}>
            MANUFACTURER
          </button>
        </div>

        <div className="role-item">
          <img src="/admin.png" alt="Admin" className="role-icon" />
          <button className="btn-role" onClick={() => chooseRole("admin")}>
            ADMIN
          </button>
        </div>

      </div>

    </div>
  );
};

export default RoleSelect;
