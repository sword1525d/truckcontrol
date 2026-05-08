using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Frotacontrol.Core.Entities;

namespace Frotacontrol.Infrastructure.Data;

public class AppDbContext : IdentityDbContext<IdentityUser>
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Company> Companies => Set<Company>();
    public DbSet<Sector> Sectors => Set<Sector>();
    public DbSet<Group> Groups => Set<Group>();
    public DbSet<SectorGroup> SectorGroups => Set<SectorGroup>();
    public new DbSet<User> Users => Set<User>();
    public DbSet<Vehicle> Vehicles => Set<Vehicle>();
    public DbSet<Run> Runs => Set<Run>();
    public DbSet<RunStop> RunStops => Set<RunStop>();
    public DbSet<LocationPoint> LocationPoints => Set<LocationPoint>();
    public DbSet<Route> Routes => Set<Route>();
    public DbSet<RouteTrip> RouteTrips => Set<RouteTrip>();
    public DbSet<RouteTripStop> RouteTripStops => Set<RouteTripStop>();
    public DbSet<Checklist> Checklists => Set<Checklist>();
    public DbSet<ChecklistItem> ChecklistItems => Set<ChecklistItem>();
    public DbSet<Refuel> Refuels => Set<Refuel>();
    public DbSet<MaintenanceRecord> MaintenanceRecords => Set<MaintenanceRecord>();
    public DbSet<Manager> Managers => Set<Manager>();
    public DbSet<StopPoint> StopPoints => Set<StopPoint>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        // ---- Company ----
        builder.Entity<Company>(e =>
        {
            e.HasKey(c => c.Id);
            e.Property(c => c.Id).HasMaxLength(50);
            e.Property(c => c.Name).HasMaxLength(200).IsRequired();
        });

        // ---- Sector ----
        builder.Entity<Sector>(e =>
        {
            e.HasKey(s => s.Id);
            e.Property(s => s.Id).HasMaxLength(50);
            e.Property(s => s.CompanyId).HasMaxLength(50).IsRequired();
            e.Property(s => s.Name).HasMaxLength(200).IsRequired();
            e.HasOne(s => s.Company).WithMany(c => c.Sectors)
                .HasForeignKey(s => s.CompanyId).OnDelete(DeleteBehavior.Cascade);
        });

        // ---- Group ----
        builder.Entity<Group>(e =>
        {
            e.HasKey(g => g.Id);
            e.Property(g => g.Id).HasMaxLength(50);
            e.Property(g => g.CompanyId).HasMaxLength(50).IsRequired();
            e.Property(g => g.Name).HasMaxLength(200).IsRequired();
            e.HasOne(g => g.Company).WithMany(c => c.Groups)
                .HasForeignKey(g => g.CompanyId).OnDelete(DeleteBehavior.Cascade);
        });

        // ---- SectorGroup ----
        builder.Entity<SectorGroup>(e =>
        {
            e.HasKey(sg => sg.SectorId);
            e.Property(sg => sg.SectorId).HasMaxLength(50);
            e.Property(sg => sg.GroupId).HasMaxLength(50).IsRequired();
            e.HasOne(sg => sg.Sector).WithMany()
                .HasForeignKey(sg => sg.SectorId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(sg => sg.Group).WithMany()
                .HasForeignKey(sg => sg.GroupId).OnDelete(DeleteBehavior.NoAction);
        });

        // ---- User ----
        builder.Entity<User>(e =>
        {
            e.HasKey(u => u.Id);
            e.Property(u => u.Id).HasMaxLength(450);
            e.Property(u => u.CompanyId).HasMaxLength(50).IsRequired();
            e.Property(u => u.SectorId).HasMaxLength(50).IsRequired();
            e.Property(u => u.Name).HasMaxLength(200).IsRequired();
            e.Property(u => u.Matricula).HasMaxLength(50).IsRequired();
            e.Property(u => u.PhotoURL).HasMaxLength(500);
            e.Property(u => u.Email).HasMaxLength(200);
            e.HasOne(u => u.Company).WithMany()
                .HasForeignKey(u => u.CompanyId).OnDelete(DeleteBehavior.NoAction);
            e.HasOne(u => u.Sector).WithMany(s => s.Users)
                .HasForeignKey(u => u.SectorId).OnDelete(DeleteBehavior.NoAction);
        });

        // ---- Vehicle ----
        builder.Entity<Vehicle>(e =>
        {
            e.HasKey(v => v.Id);
            e.Property(v => v.Id).HasMaxLength(20);
            e.Property(v => v.CompanyId).HasMaxLength(50).IsRequired();
            e.Property(v => v.SectorId).HasMaxLength(50).IsRequired();
            e.Property(v => v.Model).HasMaxLength(200).IsRequired();
            e.Property(v => v.ImageUrl).HasMaxLength(500);
            e.Property(v => v.Status).HasConversion<int>();
            e.HasOne(v => v.Company).WithMany()
                .HasForeignKey(v => v.CompanyId).OnDelete(DeleteBehavior.NoAction);
            e.HasOne(v => v.Sector).WithMany(s => s.Vehicles)
                .HasForeignKey(v => v.SectorId).OnDelete(DeleteBehavior.NoAction);
        });

        // ---- Run ----
        builder.Entity<Run>(e =>
        {
            e.HasKey(r => r.Id);
            e.Property(r => r.DriverId).HasMaxLength(450).IsRequired();
            e.Property(r => r.DriverName).HasMaxLength(200).IsRequired();
            e.Property(r => r.VehicleId).HasMaxLength(20).IsRequired();
            e.Property(r => r.TripId).HasMaxLength(100);
            e.Property(r => r.TripName).HasMaxLength(200);
            e.Property(r => r.Status).HasConversion<int>();
            e.HasOne(r => r.Vehicle).WithMany()
                .HasForeignKey(r => r.VehicleId).OnDelete(DeleteBehavior.NoAction);
            e.HasMany(r => r.Stops).WithOne(s => s.Run)
                .HasForeignKey(s => s.RunId).OnDelete(DeleteBehavior.Cascade);
            e.HasMany(r => r.LocationHistory).WithOne(l => l.Run)
                .HasForeignKey(l => l.RunId).OnDelete(DeleteBehavior.Cascade);
        });

        // ---- RunStop ----
        builder.Entity<RunStop>(e =>
        {
            e.HasKey(rs => rs.Id);
            e.Property(rs => rs.Name).HasMaxLength(200).IsRequired();
            e.Property(rs => rs.PlannedArrival).HasMaxLength(10);
            e.Property(rs => rs.PlannedDeparture).HasMaxLength(10);
            e.Property(rs => rs.Observation).HasMaxLength(500);
            e.Property(rs => rs.Status).HasConversion<int>();
            e.HasIndex(rs => new { rs.RunId, rs.SortOrder });
        });

        // ---- LocationPoint ----
        builder.Entity<LocationPoint>(e =>
        {
            e.HasKey(l => l.Id);
            e.HasIndex(l => new { l.RunId, l.Timestamp });
        });

        // ---- Route ----
        builder.Entity<Route>(e =>
        {
            e.HasKey(r => r.Id);
            e.Property(r => r.CompanyId).HasMaxLength(50).IsRequired();
            e.Property(r => r.SectorId).HasMaxLength(50).IsRequired();
            e.Property(r => r.VehicleId).HasMaxLength(20).IsRequired();
            e.Property(r => r.Date).HasMaxLength(20).IsRequired();
            e.HasOne(r => r.Vehicle).WithMany()
                .HasForeignKey(r => r.VehicleId).OnDelete(DeleteBehavior.NoAction);
            e.HasMany(r => r.Trips).WithOne(t => t.Route)
                .HasForeignKey(t => t.RouteId).OnDelete(DeleteBehavior.Cascade);
        });

        // ---- RouteTrip ----
        builder.Entity<RouteTrip>(e =>
        {
            e.HasKey(t => t.Id);
            e.Property(t => t.Name).HasMaxLength(200).IsRequired();
            e.HasMany(t => t.Stops).WithOne(s => s.Trip)
                .HasForeignKey(s => s.TripId).OnDelete(DeleteBehavior.Cascade);
        });

        // ---- RouteTripStop ----
        builder.Entity<RouteTripStop>(e =>
        {
            e.HasKey(s => s.Id);
            e.Property(s => s.Name).HasMaxLength(200).IsRequired();
            e.Property(s => s.PlannedArrival).HasMaxLength(10).IsRequired();
            e.Property(s => s.PlannedDeparture).HasMaxLength(10).IsRequired();
        });

        // ---- Checklist ----
        builder.Entity<Checklist>(e =>
        {
            e.HasKey(c => c.Id);
            e.Property(c => c.VehicleId).HasMaxLength(20).IsRequired();
            e.Property(c => c.DriverId).HasMaxLength(450).IsRequired();
            e.Property(c => c.DriverName).HasMaxLength(200).IsRequired();
            e.Property(c => c.CompanyId).HasMaxLength(50).IsRequired();
            e.Property(c => c.SectorId).HasMaxLength(50).IsRequired();
            e.HasOne(c => c.Vehicle).WithMany(v => v.Checklists)
                .HasForeignKey(c => c.VehicleId).OnDelete(DeleteBehavior.NoAction);
            e.HasMany(c => c.Items).WithOne(i => i.Checklist)
                .HasForeignKey(i => i.ChecklistId).OnDelete(DeleteBehavior.Cascade);
        });

        // ---- ChecklistItem ----
        builder.Entity<ChecklistItem>(e =>
        {
            e.HasKey(ci => ci.Id);
            e.Property(ci => ci.ItemId).HasMaxLength(50).IsRequired();
            e.Property(ci => ci.Location).HasMaxLength(1).IsRequired();
            e.Property(ci => ci.Title).HasMaxLength(200).IsRequired();
            e.Property(ci => ci.Description).HasMaxLength(500).IsRequired();
            e.Property(ci => ci.Observation).HasMaxLength(500);
            e.Property(ci => ci.Status).HasConversion<int>();
        });

        // ---- Refuel ----
        builder.Entity<Refuel>(e =>
        {
            e.HasKey(r => r.Id);
            e.Property(r => r.CompanyId).HasMaxLength(50).IsRequired();
            e.Property(r => r.SectorId).HasMaxLength(50).IsRequired();
            e.Property(r => r.VehicleId).HasMaxLength(20).IsRequired();
            e.Property(r => r.DriverId).HasMaxLength(450).IsRequired();
            e.Property(r => r.DriverName).HasMaxLength(200).IsRequired();
            e.HasOne(r => r.Vehicle).WithMany()
                .HasForeignKey(r => r.VehicleId).OnDelete(DeleteBehavior.NoAction);
        });

        // ---- MaintenanceRecord ----
        builder.Entity<MaintenanceRecord>(e =>
        {
            e.HasKey(m => m.Id);
            e.Property(m => m.VehicleId).HasMaxLength(20).IsRequired();
            e.Property(m => m.Notes).HasMaxLength(500);
            e.HasOne(m => m.Vehicle).WithMany(v => v.MaintenanceRecords)
                .HasForeignKey(m => m.VehicleId).OnDelete(DeleteBehavior.Cascade);
        });

        // ---- Manager ----
        builder.Entity<Manager>(e =>
        {
            e.HasKey(m => m.Id);
            e.Property(m => m.CompanyId).HasMaxLength(50).IsRequired();
            e.Property(m => m.SectorId).HasMaxLength(50).IsRequired();
            e.Property(m => m.Name).HasMaxLength(200).IsRequired();
            e.Property(m => m.Email).HasMaxLength(200).IsRequired();
        });

        // ---- StopPoint ----
        builder.Entity<StopPoint>(e =>
        {
            e.HasKey(sp => sp.Id);
            e.Property(sp => sp.CompanyId).HasMaxLength(50).IsRequired();
            e.Property(sp => sp.SectorId).HasMaxLength(50).IsRequired();
            e.Property(sp => sp.Name).HasMaxLength(100).IsRequired();
            e.HasIndex(sp => new { sp.CompanyId, sp.SectorId, sp.Name }).IsUnique();
            e.HasOne(sp => sp.Company).WithMany()
                .HasForeignKey(sp => sp.CompanyId).OnDelete(DeleteBehavior.NoAction);
            e.HasOne(sp => sp.Sector).WithMany()
                .HasForeignKey(sp => sp.SectorId).OnDelete(DeleteBehavior.NoAction);
        });
    }
}
